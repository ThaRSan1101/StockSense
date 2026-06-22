import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from core.db import get_db_connection

def forecast_demand(forecast_days=30):
    """
    Connects to the database, queries sales transactions, runs a Linear Regression model
    to forecast sales for the next `forecast_days` for each active product SKU,
    and returns suggested restock plans.
    """
    conn = get_db_connection()
    try:
        # 1. Fetch sales bills data
        sales_query = """
            SELECT bi.sku, bi.qty, b.created_at
            FROM sales_bill_items bi
            JOIN sales_bills b ON bi.bill_id = b.id
            WHERE b.draft = FALSE
        """
        sales_df = pd.read_sql_query(sales_query, conn)
        
        # 2. Fetch all products current stock, capacity and reorder levels
        prod_query = """
            SELECT p.sku, p.name, p.current_stock as "currentStock", 
                   p.reorder_level as "reorderLevel", p.target_capacity as "targetCapacity",
                   c.name as "category"
            FROM products p
            JOIN master_product_class m ON p.master_id = m.id
            JOIN categories c ON m.category_id = c.category_id
            WHERE p.status = 'ACTIVE'
        """
        products_df = pd.read_sql_query(prod_query, conn)
        
    finally:
        conn.close()

    results = []
    
    if sales_df.empty:
        # Fallback if no sales data yet
        print("[Forecaster] No sales data found in database. Using threshold fallback.")
        for _, prod in products_df.iterrows():
            current_stock = prod['currentStock']
            reorder_level = prod['reorderLevel']
            target_capacity = prod['targetCapacity']
            suggested = max(0, target_capacity - current_stock) if current_stock <= reorder_level else 0
            
            results.append({
                "sku": prod['sku'],
                "name": prod['name'],
                "category": prod['category'],
                "currentStock": int(current_stock),
                "reorderLevel": int(reorder_level),
                "forecastedDemand": 0,
                "suggestedQty": int(suggested),
                "urgency": "Critical" if current_stock == 0 else "Warning" if current_stock <= reorder_level else "Normal"
            })
        return results

    # Convert timestamps and extract date
    sales_df['created_at'] = pd.to_datetime(sales_df['created_at'])
    sales_df['date'] = sales_df['created_at'].dt.date
    
    # Aggregate quantity sold by SKU and Date
    daily_sales = sales_df.groupby(['sku', 'date'])['qty'].sum().reset_index()
    
    # Process each active product SKU
    for _, prod in products_df.iterrows():
        sku = prod['sku']
        name = prod['name']
        category = prod['category']
        current_stock = prod['currentStock']
        reorder_level = prod['reorderLevel']
        target_capacity = prod['targetCapacity']
        
        prod_sales = daily_sales[daily_sales['sku'] == sku]
        
        if len(prod_sales) < 5:
            # Fallback for new or low-transaction products: Simple average
            if len(prod_sales) > 0:
                avg_daily = prod_sales['qty'].mean()
            else:
                avg_daily = 0
            forecasted = avg_daily * forecast_days
        else:
            # Linear Regression for products with historical sales points
            # Convert date to date index representing number of days from start
            min_date = prod_sales['date'].min()
            prod_sales = prod_sales.copy()
            prod_sales['day_num'] = (prod_sales['date'] - min_date).apply(lambda x: x.days)
            
            # Predict values
            X = prod_sales[['day_num']].values
            y = prod_sales['qty'].values
            
            model = LinearRegression()
            model.fit(X, y)
            
            # Project into the future
            last_day = prod_sales['day_num'].max()
            future_days = np.array([[last_day + d] for d in range(1, forecast_days + 1)])
            predictions = model.predict(future_days)
            
            # Cap predictions at 0 to avoid negative values
            forecasted = sum(max(0, p) for p in predictions)
            
        forecasted = int(round(forecasted))
        
        # Suggested Quantity to order
        # We need enough to cover the current stock depletion and reach the safety level
        suggested = 0
        if current_stock <= reorder_level or current_stock - forecasted <= reorder_level:
            suggested = max(0, target_capacity - current_stock + forecasted)
            
        suggested = int(round(suggested))
        
        # Urgency level
        if current_stock == 0:
            urgency = "Critical"
        elif current_stock <= reorder_level:
            urgency = "Warning"
        else:
            urgency = "Normal"
            
        results.append({
            "sku": sku,
            "name": name,
            "category": category,
            "currentStock": int(current_stock),
            "reorderLevel": int(reorder_level),
            "forecastedDemand": forecasted,
            "suggestedQty": suggested,
            "urgency": urgency
        })
        
    return results

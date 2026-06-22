import pandas as pd
from datetime import datetime, timedelta
from core.db import get_db_connection

def classify_stock_velocity(analysis_days=30):
    """
    Queries sales for the past `analysis_days` and classifies each active product
    into Fast, Slow, or Dead stock based on real turnover statistics.
    """
    conn = get_db_connection()
    try:
        # Fetch active products
        prod_query = """
            SELECT p.sku, p.name, p.current_stock as "currentStock", 
                   p.cost_price as "costPrice", p.selling_price as "sellingPrice",
                   p.created_at as "createdAt", c.name as "category"
            FROM products p
            JOIN master_product_class m ON p.master_id = m.id
            JOIN categories c ON m.category_id = c.category_id
            WHERE p.status = 'ACTIVE'
        """
        products_df = pd.read_sql_query(prod_query, conn)
        
        # Fetch sales in the past N days
        sales_query = f"""
            SELECT bi.sku, bi.qty, b.created_at as "createdAt"
            FROM sales_bill_items bi
            JOIN sales_bills b ON bi.bill_id = b.id
            WHERE b.draft = FALSE AND b.created_at >= NOW() - INTERVAL '{analysis_days} days'
        """
        sales_df = pd.read_sql_query(sales_query, conn)
        
    finally:
        conn.close()

    results = []
    
    if products_df.empty:
        return results

    # Aggregate units sold by SKU
    if not sales_df.empty:
        sales_sum = sales_df.groupby('sku')['qty'].sum().reset_index()
        sales_count = sales_df.groupby('sku')['qty'].count().reset_index().rename(columns={'qty': 'events'})
        sales_merged = pd.merge(sales_sum, sales_count, on='sku', how='outer')
        sales_map = {row['sku']: (row['qty'], row['events']) for _, row in sales_merged.iterrows()}
    else:
        sales_map = {}

    now = datetime.now()

    for _, row in products_df.iterrows():
        sku = row['sku']
        name = row['name']
        stock = row['currentStock']
        cost = row['costPrice']
        price = row['sellingPrice']
        created_at = pd.to_datetime(row['createdAt'])
        category = row['category']

        # Get sales data
        total_units, sale_events = sales_map.get(sku, (0, 0))
        avg_units_per_day = total_units / analysis_days
        
        # Calculate product age in days
        product_age_days = (now - created_at.replace(tzinfo=None)).days

        # ─── Classification Heuristic ───
        # 1. Fast Stock: Sold frequently and in high volume
        if total_units > 40 or sale_events > 15:
            velocity_label = "Fast Moving"
        # 2. Dead Stock: No sales at all for at least 30 days (excluding brand new products)
        elif total_units == 0 and stock > 0 and product_age_days >= 30:
            velocity_label = "Dead Stock"
        # 3. Slow Moving: Extremely low sales
        elif 0 < total_units <= 8:
            velocity_label = "Slow Moving"
        # 4. Normal: In-between
        else:
            velocity_label = "Normal"

        results.append({
            "sku": sku,
            "name": name,
            "category": category,
            "currentStock": int(stock),
            "unitsSold": int(total_units),
            "saleEvents": int(sale_events),
            "avgUnitsPerDay": float(round(avg_units_per_day, 3)),
            "daysInactive": int(analysis_days) if total_units == 0 else 0, # Placeholder or can query actual days
            "costValue": float(stock * cost),
            "status": velocity_label
        })

    # Sort: Fast moving first, then normal, slow, dead
    order = {"Fast Moving": 0, "Normal": 1, "Slow Moving": 2, "Dead Stock": 3}
    results.sort(key=lambda x: (order.get(x['status'], 4), -x['unitsSold']))
    
    return results

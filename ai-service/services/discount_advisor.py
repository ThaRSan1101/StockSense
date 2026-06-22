from datetime import datetime
import pandas as pd
from core.db import get_db_connection

def recommend_discounts():
    """
    Scans products for expiring inventory or off-season items,
    and returns suggested discount campaigns for the admin to approve.
    """
    conn = get_db_connection()
    try:
        query = """
            SELECT p.sku, p.name, p.current_stock as "currentStock", 
                   p.cost_price as "costPrice", p.selling_price as "sellingPrice",
                   p.expiry_date as "expiryDate", p.seasonal,
                   c.name as "category"
            FROM products p
            JOIN master_product_class m ON p.master_id = m.id
            JOIN categories c ON m.category_id = c.category_id
            WHERE p.status = 'ACTIVE' AND p.current_stock > 0
        """
        df = pd.read_sql_query(query, conn)
    finally:
        conn.close()

    recommendations = []
    current_date = datetime.now().date()
    current_month = datetime.now().month

    if df.empty:
        return recommendations

    # Seasons mapping
    # 1-12 represents months
    seasons = {
        "summer": [3, 4, 5, 6, 7, 8],      # March to August
        "monsoon": [9, 10, 11],            # September to November
        "winter": [12, 1, 2],              # December to February
    }

    for _, row in df.iterrows():
        sku = row['sku']
        name = row['name']
        stock = row['currentStock']
        cost = row['costPrice']
        price = row['sellingPrice']
        expiry = row['expiryDate']
        seasonal = row['seasonal']
        category = row['category']

        discount_val = 0
        reason = ""
        action = "None"
        
        # ─── 1. Check Expiry Wastage Risk ───────────────────────────
        if pd.notna(expiry):
            # Parse expiry date (could be datetime object or string)
            if isinstance(expiry, str):
                expiry_dt = datetime.strptime(expiry.split('T')[0], "%Y-%m-%d").date()
            else:
                expiry_dt = pd.to_datetime(expiry).date()
                
            days_to_expiry = (expiry_dt - current_date).days

            if days_to_expiry < 0:
                discount_val = 100
                reason = f"Expired on {expiry_dt}"
                action = "Remove Shelf"
            elif days_to_expiry <= 14:
                discount_val = 50
                reason = f"Expiry in {days_to_expiry} days (Critical)"
                action = "Clearance 50% Off"
            elif days_to_expiry <= 30:
                discount_val = 35
                reason = f"Expiry in {days_to_expiry} days"
                action = "Clearance 35% Off"
            elif days_to_expiry <= 60:
                discount_val = 20
                reason = f"Expiry in {days_to_expiry} days"
                action = "Promo 20% Off"
            elif days_to_expiry <= 90:
                discount_val = 10
                reason = f"Expiry in {days_to_expiry} days"
                action = "Promo 10% Off"

        # ─── 2. Check Seasonal Clearance (if no urgent expiry discount) ───
        if discount_val == 0 and seasonal and isinstance(seasonal, str) and seasonal.strip().lower() != 'none':
            season_key = seasonal.strip().lower()
            if season_key in seasons:
                active_months = seasons[season_key]
                if current_month not in active_months and stock >= 30:
                    # Current month is off-season, and we have significant stock remaining
                    discount_val = 15
                    reason = f"Off-season stock clearance ({seasonal})"
                    action = "Seasonal Markdown 15% Off"

        if discount_val > 0:
            promo_price = price * (1 - (discount_val / 100.0))
            recommendations.append({
                "sku": sku,
                "name": name,
                "category": category,
                "currentStock": int(stock),
                "originalPrice": float(price),
                "suggestedDiscount": int(discount_val),
                "promoPrice": float(round(promo_price, 2)),
                "reason": reason,
                "suggestedAction": action
            })

    # Sort recommendations by highest discount value first
    recommendations.sort(key=lambda x: x['suggestedDiscount'], reverse=True)
    return recommendations

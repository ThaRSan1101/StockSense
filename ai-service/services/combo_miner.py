import os
import itertools
from collections import Counter
from datetime import datetime
import pandas as pd
import google.generativeai as genai
from core.db import get_db_connection
from services.velocity_analyzer import classify_stock_velocity

def mine_combos(min_support=0.01, min_confidence=0.1):
    """
    Analyzes historical sales bills to find items frequently purchased together.
    Identifies pairs of products (ideally pairing a fast-moving item with a slow/dead stock item),
    uses Gemini API to filter out incompatible items (e.g., soda and rice), and returns suggested combos.
    """
    conn = get_db_connection()
    try:
        # Fetch transaction items
        bill_items_query = """
            SELECT bi.bill_id as "billId", bi.sku, p.name, c.name as "category", p.selling_price as "sellingPrice", p.expiry_date as "expiryDate"
            FROM sales_bill_items bi
            JOIN products p ON bi.sku = p.sku
            JOIN master_product_class m ON p.master_id = m.id
            JOIN categories c ON m.category_id = c.category_id
            JOIN sales_bills b ON bi.bill_id = b.id
            WHERE b.draft = FALSE
        """
        df = pd.read_sql_query(bill_items_query, conn)
    finally:
        conn.close()

    if df.empty:
        print("[ComboMiner] No sales history found.")
        return []

    # Get velocity classification to know which items are fast vs slow/dead
    velocity_results = classify_stock_velocity()
    velocity_map = {item['sku']: item['status'] for item in velocity_results}

    # Group items by bill ID
    transactions = df.groupby('billId')['sku'].apply(list).tolist()
    total_tx = len(transactions)
    if total_tx == 0:
        return []

    # 1. Count individual item frequencies
    item_counts = Counter()
    for tx in transactions:
        item_counts.update(set(tx)) # count SKU once per transaction

    # 2. Count pair frequencies
    pair_counts = Counter()
    for tx in transactions:
        unique_items = sorted(list(set(tx)))
        if len(unique_items) < 2:
            continue
        # Generate all 2-item pairs
        for pair in itertools.combinations(unique_items, 2):
            pair_counts[pair] += 1

    # Product SKU to details map
    prod_details = {}
    for _, row in df.iterrows():
        prod_details[row['sku']] = {
            "name": row['name'],
            "category": row['category'],
            "price": float(row['sellingPrice']),
            "expiry": row['expiryDate'] if 'expiryDate' in row and pd.notna(row['expiryDate']) else None
        }

    # Generate candidate rules
    candidates = []
    current_date = datetime.now().date()
    for pair, count in pair_counts.items():
        sku_a, sku_b = pair
        support = count / total_tx
        
        if support < min_support:
            continue
            
        # Confidence A -> B and B -> A
        conf_a_to_b = count / item_counts[sku_a]
        conf_b_to_a = count / item_counts[sku_b]
        
        # Lift
        lift = support / ((item_counts[sku_a] / total_tx) * (item_counts[sku_b] / total_tx))

        # Check velocity labels
        vel_a = velocity_map.get(sku_a, "Normal")
        vel_b = velocity_map.get(sku_b, "Normal")

        # Check expiry
        is_expiring_a = False
        is_expiring_b = False
        
        expiry_a = prod_details[sku_a].get("expiry")
        if expiry_a:
            try:
                if isinstance(expiry_a, str):
                    expiry_dt_a = datetime.strptime(expiry_a.split('T')[0], "%Y-%m-%d").date()
                else:
                    expiry_dt_a = pd.to_datetime(expiry_a).date()
                days_to_expiry_a = (expiry_dt_a - current_date).days
                if 0 <= days_to_expiry_a <= 90:
                    is_expiring_a = True
            except Exception as ex:
                print(f"[ComboMiner] Error parsing expiry for {sku_a}: {ex}")

        expiry_b = prod_details[sku_b].get("expiry")
        if expiry_b:
            try:
                if isinstance(expiry_b, str):
                    expiry_dt_b = datetime.strptime(expiry_b.split('T')[0], "%Y-%m-%d").date()
                else:
                    expiry_dt_b = pd.to_datetime(expiry_b).date()
                days_to_expiry_b = (expiry_dt_b - current_date).days
                if 0 <= days_to_expiry_b <= 90:
                    is_expiring_b = True
            except Exception as ex:
                print(f"[ComboMiner] Error parsing expiry for {sku_b}: {ex}")

        # Prioritize pairing Fast + Slow/Dead/Expiring to clear inventory
        is_clearing_slow = False
        if (vel_a == "Fast Moving" and (vel_b in ["Slow Moving", "Dead Stock"] or is_expiring_b)) or \
           (vel_b == "Fast Moving" and (vel_a in ["Slow Moving", "Dead Stock"] or is_expiring_a)):
            is_clearing_slow = True

        candidates.append({
            "sku_a": sku_a,
            "sku_b": sku_b,
            "name_a": prod_details[sku_a]["name"],
            "name_b": prod_details[sku_b]["name"],
            "category_a": prod_details[sku_a]["category"],
            "category_b": prod_details[sku_b]["category"],
            "price_a": prod_details[sku_a]["price"],
            "price_b": prod_details[sku_b]["price"],
            "support": float(round(support, 4)),
            "confidence": float(round(max(conf_a_to_b, conf_b_to_a), 4)),
            "lift": float(round(lift, 4)),
            "isClearingSlow": is_clearing_slow,
            "velocity_a": vel_a,
            "velocity_b": vel_b,
            "isExpiringA": is_expiring_a,
            "isExpiringB": is_expiring_b
        })

    # Sort candidates by lift/confidence
    candidates.sort(key=lambda x: (-x['isClearingSlow'], -x['lift'], -x['confidence']))

    # Filter with category compatibility heuristics and Gemini validation
    validated_combos = []
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    # Initialize Gemini model if key is available
    gemini_available = False
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            gemini_available = True
            print("[ComboMiner] Gemini API key configured. Utilizing Gemini for combo validation.")
        except Exception as e:
            print(f"[ComboMiner] Failed to initialize Gemini API: {e}. Falling back to rule-based validation.")

    # Limit to top 15 candidate combos to screen
    top_candidates = candidates[:15]

    for c in top_candidates:
        prod1 = c['name_a']
        cat1 = c['category_a']
        prod2 = c['name_b']
        cat2 = c['category_b']

        is_valid = False
        combo_name = f"{prod1.split(' ')[0]} & {prod2.split(' ')[0]} Savings Combo"
        discount_val = 15.0 # default discount
        desc = "Suggested combo based on customer purchasing history."

        # If Gemini is available, let it validate compatibility
        if gemini_available:
            prompt = f"""
            You are an expert retail merchandiser. Review this candidate product bundle mined from sales transactions:
            Product 1: "{prod1}" (Category: "{cat1}")
            Product 2: "{prod2}" (Category: "{cat2}")

            Verify if these two products are complementary and make sense to purchase together.
            Complementary items: Toothbrush + Toothpaste, Tea + Biscuits, Milk + Bread, Soap + Shampoo.
            Nonsensical items (MUST REJECT): Soda + Rice, Laundry Soap + Baby Food, Floor Cleaner + Ice Cream.

            Provide your response in strict JSON format:
            {{
              "isComplementary": true or false,
              "comboName": "A catchy marketing name for this combo (max 4 words)",
              "discountPercentage": integer between 10 and 25,
              "reason": "Short explanation of why it works"
            }}
            """
            try:
                # Request JSON output
                response = model.generate_content(
                    prompt, 
                    generation_config={"response_mime_type": "application/json"}
                )
                import json
                res_data = json.loads(response.text.strip())
                if res_data.get("isComplementary"):
                    is_valid = True
                    combo_name = res_data.get("comboName", combo_name)
                    discount_val = float(res_data.get("discountPercentage", 15))
                    desc = res_data.get("reason", desc)
                else:
                    is_valid = False
                    print(f"[ComboMiner] Gemini rejected combo: {prod1} + {prod2}")
            except Exception as e:
                print(f"[ComboMiner] Gemini error: {e}. Using rule-based fallback for this pair.")
                is_valid, combo_name, discount_val, desc = check_rule_based_compatibility(c, prod1, cat1, prod2, cat2)
        else:
            # Fallback to category-based compatibility rules
            is_valid, combo_name, discount_val, desc = check_rule_based_compatibility(c, prod1, cat1, prod2, cat2)

        if is_valid:
            original_total = c['price_a'] + c['price_b']
            discounted_total = original_total * (1 - (discount_val / 100.0))
            
            validated_combos.append({
                "name": combo_name,
                "sku_a": c['sku_a'],
                "sku_b": c['sku_b'],
                "product_a": prod1,
                "product_b": prod2,
                "price_a": c['price_a'],
                "price_b": c['price_b'],
                "originalPrice": float(round(original_total, 2)),
                "discountValue": int(discount_val),
                "comboPrice": float(round(discounted_total, 2)),
                "reason": desc,
                "support": c['support'],
                "confidence": c['confidence'],
                "lift": c['lift'],
                "isClearingSlow": c['isClearingSlow']
            })

    # Return validated combos
    return validated_combos

def check_rule_based_compatibility(candidate, prod1, cat1, prod2, cat2):
    """
    Standard category compatibility check to make sure combos are logical.
    """
    # Exclude cleaning/laundry products bundled with food
    ingestible_cats = ['Grocery & Staples', 'Beverages', 'Snacks & Confectionery', 'Dairy & Chilled', 'Frozen Foods', 'Bakery']
    chemical_cats = ['Household Care']
    
    if (cat1 in chemical_cats and cat2 in ingestible_cats) or (cat2 in chemical_cats and cat1 in ingestible_cats):
        return False, "", 0, ""
        
    # Prevent bundling staples like 25Kg Rice bags or 50Kg Sugar sacks into quick POS combos
    exclude_keywords = ['5kg', '10kg', '25kg', '50kg', '5l', '2l', '4l']
    if any(k in prod1.lower() for k in exclude_keywords) or any(k in prod2.lower() for k in exclude_keywords):
        return False, "", 0, ""

    # Complementary combinations rules
    valid = False
    desc = "Receipt analysis shows these items are commonly bought together."
    discount = 15.0

    # Same category bundles
    if cat1 == cat2:
        valid = True
        if cat1 == 'Personal Care':
            desc = "Daily Personal Hygiene Bundle"
            discount = 12.0
        elif cat1 == 'Snacks & Confectionery':
            desc = "Sweet & Savory Snack Pack"
            discount = 10.0
        elif cat1 == 'Beverages':
            desc = "Refreshment Drink Pack"
            discount = 10.0
    # Complementary categories (e.g. Snacks + Beverages, Dairy + Bakery, Local dry fish + Groceries)
    elif (cat1 == 'Beverages' and cat2 == 'Snacks & Confectionery') or (cat2 == 'Beverages' and cat1 == 'Snacks & Confectionery'):
        valid = True
        desc = "Snack Time Combo Deal"
        discount = 15.0
    elif (cat1 == 'Dairy & Chilled' and cat2 == 'Bakery') or (cat2 == 'Dairy & Chilled' and cat1 == 'Bakery'):
        valid = True
        desc = "Fresh Breakfast Combo"
        discount = 18.0
    elif (cat1 == 'Local & Dry Goods' and cat2 == 'Grocery & Staples') or (cat2 == 'Local & Dry Goods' and cat1 == 'Grocery & Staples'):
        valid = True
        desc = "Local Curries Staples Deal"
        discount = 12.0

    # Build default combo name
    words_a = prod1.split(' ')
    words_b = prod2.split(' ')
    name = f"{words_a[0]} & {words_b[0]} Combo Saver"

    return valid, name, discount, desc

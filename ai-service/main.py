import uuid
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.forecaster import forecast_demand
from services.discount_advisor import recommend_discounts
from services.velocity_analyzer import classify_stock_velocity
from services.combo_miner import mine_combos
from core.db import get_db_connection

app = FastAPI(title="StockSense AI Optimization Service", version="1.0.0")

# Enable CORS for communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/')
def read_root():
    return {
        "status": "online",
        "service": "StockSense AI Service",
        "description": "Exposes ML demand forecasting, discount heuristics, Apriori combo mining, and automated stock alerts."
    }

@app.get('/api/predict/demand')
def get_demand_forecast(days: int = 30):
    try:
        return {"success": True, "data": forecast_demand(days)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/predict/discounts')
def get_discount_recommendations():
    try:
        return {"success": True, "data": recommend_discounts()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/predict/velocity')
def get_velocity_classification(days: int = 30):
    try:
        return {"success": True, "data": classify_stock_velocity(days)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/predict/combos')
def get_combo_suggestions(support: float = 0.005, confidence: float = 0.05):
    try:
        return {"success": True, "data": mine_combos(min_support=support, min_confidence=confidence)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/run-ai-sync')
def run_ai_sync():
    """
    Triggers the AI optimization pipeline:
    1. Runs stock velocity analysis to identify slow and dead items.
    2. Runs Apriori combo miner to package slow-moving items with popular items.
    3. Runs smart discounting to recommend markdown clearance on expiring items.
    4. Automatically writes DRAFT discount campaigns and ADMIN notifications to the database.
    """
    print("[AI Sync] Beginning database synchronization pipeline...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # ─────────────────────────────────────────────────────────────────────
        # 1. Clear Old AI Draft Discounts & Notifications (to prevent duplicates)
        # ─────────────────────────────────────────────────────────────────────
        print("[AI Sync] Cleaning up old pending AI recommendations...")
        # Get IDs of old AI discounts
        cursor.execute("SELECT id FROM discounts WHERE label IN ('AI CLEARANCE', 'AI COMBO') AND approval_status = 'DRAFT'")
        old_discount_ids = [row[0] for row in cursor.fetchall()]
        
        if old_discount_ids:
            # Delete associated notifications
            for d_id in old_discount_ids:
                cursor.execute(
                    "DELETE FROM notifications WHERE type = 'DISCOUNT_APPROVAL' AND metadata->>'discountId' = %s",
                    (d_id,)
                )
            # Delete discounts (cascades delete to seasonal_or_daily_products & discount_combo_items)
            cursor.execute(
                "DELETE FROM discounts WHERE label IN ('AI CLEARANCE', 'AI COMBO') AND approval_status = 'DRAFT'"
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # 2. Process Expiry & Seasonal Clearance Discounts
        # ─────────────────────────────────────────────────────────────────────
        print("[AI Sync] Analyzing inventory for smart clearance markdowns...")
        discounts = recommend_discounts()
        discount_count = 0
        
        for d in discounts:
            sku = d['sku']
            name = d['name']
            discount_val = d['suggestedDiscount']
            reason = d['reason']
            action = d['suggestedAction']
            
            # Skip expired items from generating discounts (they should be discarded/written off instead)
            if action == "Remove Shelf":
                continue
                
            discount_id = str(uuid.uuid4())
            campaign_name = f"AI Clearance: {name}"
            
            # Insert draft discount campaign
            cursor.execute(
                """
                INSERT INTO discounts (id, name, type, discount_value, label, is_active, approval_status, created_at, updated_at)
                VALUES (%s, %s, 'SEASONAL', %s, 'AI CLEARANCE', TRUE, 'DRAFT', NOW(), NOW())
                """,
                (discount_id, campaign_name, discount_val)
            )
            
            # Map product SKU
            cursor.execute(
                """
                INSERT INTO seasonal_or_daily_products (id, discount_id, sku)
                VALUES (%s, %s, %s)
                """,
                (str(uuid.uuid4()), discount_id, sku)
            )
            
            # Create ADMIN notification for approval
            notify_id = str(uuid.uuid4())
            notify_title = f"AI Clearance Markdown: {name}"
            notify_msg = f"AI recommended a markdown discount of {discount_val}% to clear {name} due to: {reason}. Approval is required to activate."
            
            metadata = {
                "discountId": discount_id,
                "campaignName": campaign_name,
                "discountValue": discount_val,
                "type": "SEASONAL"
            }
            
            cursor.execute(
                """
                INSERT INTO notifications (id, type, severity, title, message, sku, suggested_action, metadata, target_role, created_at, updated_at)
                VALUES (%s, 'DISCOUNT_APPROVAL', 'INFO', %s, %s, %s, 'View Request', %s::jsonb, 'ADMIN', NOW(), NOW())
                """,
                (notify_id, notify_title, notify_msg, sku, json.dumps(metadata))
            )
            discount_count += 1

        # ─────────────────────────────────────────────────────────────────────
        # 3. Process Apriori Combo Bundles
        # ─────────────────────────────────────────────────────────────────────
        print("[AI Sync] Running Apriori combo mining rules...")
        combos = mine_combos()
        combo_count = 0
        
        for c in combos:
            sku_a = c['sku_a']
            sku_b = c['sku_b']
            combo_name = c['name']
            discount_val = c['discountValue']
            reason = c['reason']
            
            discount_id = str(uuid.uuid4())
            
            # Insert draft combo discount campaign
            cursor.execute(
                """
                INSERT INTO discounts (id, name, type, discount_value, label, is_active, approval_status, created_at, updated_at)
                VALUES (%s, %s, 'COMBO', %s, 'AI COMBO', TRUE, 'DRAFT', NOW(), NOW())
                """,
                (discount_id, combo_name, discount_val)
            )
            
            # Map products to discount combo items
            cursor.execute(
                """
                INSERT INTO discount_combo_items (id, discount_id, sku, min_qty)
                VALUES (%s, %s, %s, 1)
                """,
                (str(uuid.uuid4()), discount_id, sku_a)
            )
            
            cursor.execute(
                """
                INSERT INTO discount_combo_items (id, discount_id, sku, min_qty)
                VALUES (%s, %s, %s, 1)
                """,
                (str(uuid.uuid4()), discount_id, sku_b)
            )
            
            # Create ADMIN notification for approval
            notify_id = str(uuid.uuid4())
            notify_title = f"AI Bundle Recommendation: {combo_name}"
            notify_msg = f"AI recommends bundling {c['product_a']} and {c['product_b']} with a {discount_val}% package discount. Reason: {reason}."
            
            metadata = {
                "discountId": discount_id,
                "campaignName": combo_name,
                "discountValue": discount_val,
                "type": "COMBO"
            }
            
            cursor.execute(
                """
                INSERT INTO notifications (id, type, severity, title, message, sku, suggested_action, metadata, target_role, created_at, updated_at)
                VALUES (%s, 'DISCOUNT_APPROVAL', 'INFO', %s, %s, NULL, 'View Request', %s::jsonb, 'ADMIN', NOW(), NOW())
                """,
                (notify_id, notify_title, notify_msg, json.dumps(metadata))
            )
            combo_count += 1
            
        conn.commit()
        print(f"[AI Sync] Successfully synchronized database. Generated {discount_count} clearanced markdowns and {combo_count} bundle combos.")
        return {
            "success": True,
            "message": f"AI sync successful. Generated {discount_count} markdowns and {combo_count} combos awaiting approval."
        }
        
    except Exception as e:
        conn.rollback()
        print(f"[AI Sync] Error running synchronization pipeline: {e}")
        raise HTTPException(status_code=500, detail=f"Database synchronization error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

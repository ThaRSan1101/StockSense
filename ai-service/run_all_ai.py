import os
import sys
from datetime import datetime, date, timedelta

# Ensure ai-service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.services.forecast_engine import run_monthly_forecasting
from app.services.db_operations import (
    create_initial_run,
    save_analyses_and_forecasts,
    mark_run_completed,
    mark_run_failed
)
from app.services.association_rules import mine_association_rules
from app.services.substitute_detector import detect_substitutes
from app.services.combo_generator import generate_combo_suggestions

def main():
    print("==================================================")
    print("STOCKSENSE AI PIPELINE REGENERATION")
    print("==================================================")
    db = SessionLocal()
    try:
        # 1. Demand Forecasting Pipeline for 2026-01-01 (Cutoff: 2025-12-31)
        target_month_str = "2026-01-01"
        target_month_date = date(2026, 1, 1)
        data_start = date(2023, 1, 1)
        cutoff_date = date(2025, 12, 31)

        print("\n[1/2] Running Demand Forecasting Pipeline...")
        print(f"  Target Month: {target_month_str}")
        print(f"  Data Period:  {data_start} to {cutoff_date}")
        
        run_id = create_initial_run(db, target_month_date, data_start, cutoff_date, trigger_type="SYSTEM")
        print(f"  Created ForecastRun ID: {run_id}")

        start_time = datetime.now()
        run_meta, analyses, forecasts = run_monthly_forecasting(db, target_month_str)

        # Sanitize any date/datetime objects inside modelParameters for JSON serialization
        for f in forecasts:
            if "modelParameters" in f and isinstance(f["modelParameters"], dict):
                f["modelParameters"] = {
                    k: str(v) if isinstance(v, (date, datetime)) else v
                    for k, v in f["modelParameters"].items()
                }

        save_analyses_and_forecasts(db, run_id, analyses, forecasts)
        mark_run_completed(
            db,
            run_id,
            total_products=run_meta["productsProcessed"] + run_meta["productsFailed"],
            success_count=run_meta["productsProcessed"],
            failure_count=run_meta["productsFailed"],
            config_snapshot=run_meta["configurationSnapshot"]
        )
        duration = (datetime.now() - start_time).total_seconds()
        print(f"  [SUCCESS] Forecast Run Completed in {duration:.2f}s!")
        print(f"     Products Processed: {run_meta['productsProcessed']}")
        print(f"     Products Failed:    {run_meta['productsFailed']}")
        print(f"     Forecast Records:   {len(forecasts)}")
        print(f"     Analyses Records:   {len(analyses)}")

        # 2. Association Mining & Combo Opportunities Pipeline
        print("\n[2/2] Running Market-Basket Association & Combo Pipeline...")
        assoc_start = datetime.now()
        assoc_run_id = mine_association_rules(db, cutoff_date=cutoff_date, created_by="SYSTEM")
        print(f"  [SUCCESS] Association Mining Completed! Run ID: {assoc_run_id}")

        detect_substitutes(db)
        print("  [SUCCESS] Substitute Detection Completed!")

        suggestions_count = generate_combo_suggestions(db, association_run_id=assoc_run_id)
        assoc_duration = (datetime.now() - assoc_start).total_seconds()
        print(f"  [SUCCESS] Combo Suggestions Generated: {suggestions_count} in {assoc_duration:.2f}s!")

        print("\n==================================================")
        print("ALL AI PIPELINES REGENERATED SUCCESSFULLY!")
        print("==================================================")

    except Exception as e:
        print(f"\n[ERROR] Error during AI pipeline execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()

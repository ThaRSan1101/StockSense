import uuid
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

def check_existing_run(db: Session, target_month: date) -> str:
    """
    Checks if a completed forecast run exists for the target month.
    Returns: run_id of the most recent completed run if it exists, else None
    """
    query = text("""
    SELECT id FROM demand_forecast_runs 
    WHERE target_month = :target_month AND status = 'COMPLETED'
    ORDER BY created_at DESC
    LIMIT 1
    """)
    res = db.execute(query, {"target_month": target_month}).first()
    return res[0] if res else None

def delete_existing_run(db: Session, run_id: str):
    """
    Deletes an existing forecast run and its dependent analyses/forecasts (on delete cascade handles it).
    """
    query = text("DELETE FROM demand_forecast_runs WHERE id = :run_id")
    db.execute(query, {"run_id": run_id})
    db.commit()

def create_initial_run(db: Session, target_month: date, data_start: date, data_end: date, trigger_type="MANUAL", requested_by=None) -> str:
    run_id = str(uuid.uuid4())
    
    # Get next version number
    version_query = text("""
    SELECT COALESCE(MAX(version), 0) + 1 FROM demand_forecast_runs WHERE target_month = :target_month
    """)
    version = db.execute(version_query, {"target_month": target_month}).scalar() or 1
    
    query = text("""
    INSERT INTO demand_forecast_runs (
        id, target_month, version, status, trigger_type, data_start_date, data_end_date, 
        started_at, total_products, success_count, failure_count, created_at, updated_at, requested_by
    )
    VALUES (
        :id, :target_month, :version, 'RUNNING', :trigger_type, :data_start, :data_end, 
        :started_at, 0, 0, 0, :created_at, :updated_at, :requested_by
    )
    """)
    db.execute(query, {
        "id": run_id,
        "target_month": target_month,
        "version": version,
        "trigger_type": trigger_type,
        "data_start": data_start,
        "data_end": data_end,
        "started_at": datetime.now(),
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "requested_by": requested_by
    })
    db.commit()
    return run_id

def mark_run_completed(db: Session, run_id: str, total_products: int, success_count: int, failure_count: int, config_snapshot: dict = None):
    query = text("""
    UPDATE demand_forecast_runs
    SET status = 'COMPLETED', completed_at = :completed_at, updated_at = :updated_at,
        total_products = :total_products, success_count = :success_count, failure_count = :failure_count,
        configuration_snapshot = :configuration_snapshot
    WHERE id = :id
    """)
    db.execute(query, {
        "id": run_id,
        "completed_at": datetime.now(),
        "updated_at": datetime.now(),
        "total_products": total_products,
        "success_count": success_count,
        "failure_count": failure_count,
        "configuration_snapshot": json.dumps(config_snapshot, default=str) if config_snapshot else None
    })
    db.commit()

def mark_run_failed(db: Session, run_id: str, error_message: str):
    query = text("""
    UPDATE demand_forecast_runs
    SET status = 'FAILED', completed_at = :completed_at, updated_at = :updated_at, error_message = :error_message
    WHERE id = :id
    """)
    db.execute(query, {
        "id": run_id,
        "completed_at": datetime.now(),
        "updated_at": datetime.now(),
        "error_message": error_message
    })
    db.commit()

def save_analyses_and_forecasts(
    db: Session,
    run_id: str,
    analyses: list,
    forecasts: list
):
    # Insert analyses in batch
    for row in analyses:
        analysis_id = str(uuid.uuid4())
        query = text("""
        INSERT INTO demand_analysis (
            id, forecast_run_id, product_id, usable_history_days, complete_history_months, data_quality, 
            recent_30_sales, previous_30_sales, recent_growth_percentage, three_month_average, 
            six_month_average, twelve_month_average, same_month_historical_average, 
            seasonal_uplift_percentage, discount_uplift_percentage, refund_quantity, refund_rate, 
            stock_out_days, stock_out_ratio, zero_sales_ratio, coefficient_of_variation, 
            average_demand_interval, trend_slope, primary_behaviour, trend_direction, 
            additional_behaviour_tags, analysis_warnings, created_at
        ) VALUES (
            :id, :run_id, :product_id, :usable_history_days, :complete_history_months, :data_quality, 
            :recent_30_sales, :previous_30_sales, :recent_growth_percentage, :three_month_average, 
            :six_month_average, :twelve_month_average, :same_month_historical_average, 
            :seasonal_uplift_percentage, :discount_uplift_percentage, :refund_quantity, :refund_rate, 
            :stock_out_days, :stock_out_ratio, :zero_sales_ratio, :coefficient_of_variation, 
            :average_demand_interval, :trend_slope, :primary_behaviour, :trend_direction, 
            :additional_behaviour_tags, :analysis_warnings, :created_at
        )
        """)
        db.execute(query, {
            "id": analysis_id,
            "run_id": run_id,
            "product_id": row["productId"],
            "usable_history_days": row["usableHistoryDays"],
            "complete_history_months": row["completeHistoryMonths"],
            "data_quality": row["dataQuality"],
            "recent_30_sales": row["recent30Sales"],
            "previous_30_sales": row["previous30Sales"],
            "recent_growth_percentage": row["recentGrowthPercentage"],
            "three_month_average": row["threeMonthAverage"],
            "six_month_average": row["sixMonthAverage"],
            "twelve_month_average": row["twelveMonthAverage"],
            "same_month_historical_average": row["sameMonthHistoricalAverage"],
            "seasonal_uplift_percentage": row["seasonalUpliftPercentage"],
            "discount_uplift_percentage": row["discountUpliftPercentage"],
            "refund_quantity": row["refundQuantity"],
            "refund_rate": row["refundRate"],
            "stock_out_days": row["stockOutDays"],
            "stock_out_ratio": row["stockOutRatio"],
            "zero_sales_ratio": row["zeroSalesRatio"],
            "coefficient_of_variation": row["coefficientOfVariation"],
            "average_demand_interval": row["averageDemandInterval"],
            "trend_slope": row["trendSlope"],
            "primary_behaviour": row["primaryBehaviour"],
            "trend_direction": row["trendDirection"],
            "additional_behaviour_tags": json.dumps(row["additionalBehaviourTags"], default=str),
            "analysis_warnings": json.dumps(row["analysisWarnings"], default=str) if row["analysisWarnings"] else None,
            "created_at": datetime.now()
        })

    # Insert forecasts in batch
    for row in forecasts:
        forecast_id = str(uuid.uuid4())
        query = text("""
        INSERT INTO demand_forecasts (
            id, forecast_run_id, product_id, target_month, current_stock, confirmed_incoming_stock, 
            predicted_demand, safety_stock, required_stock, recommended_order_quantity, 
            stock_coverage_days, selected_model, model_parameters, mae, rmse, wape, 
            accuracy_score, reliability_level, prediction_reason, status, created_at, updated_at
        ) VALUES (
            :id, :run_id, :product_id, :target_month, :current_stock, :confirmed_incoming_stock, 
            :predicted_demand, :safety_stock, :required_stock, :recommended_order_quantity, 
            :stock_coverage_days, :selected_model, :model_parameters, :mae, :rmse, :wape, 
            :accuracy_score, :reliability_level, :prediction_reason, :status, :created_at, :updated_at
        )
        """)
        db.execute(query, {
            "id": forecast_id,
            "run_id": run_id,
            "product_id": row["productId"],
            "target_month": row["targetMonth"],
            "current_stock": row["currentStock"],
            "confirmed_incoming_stock": row.get("confirmedIncomingStock", 0),
            "predicted_demand": row["predictedDemand"],
            "safety_stock": row["safetyStock"],
            "required_stock": row["requiredStock"],
            "recommended_order_quantity": row["recommendedOrderQuantity"],
            "stock_coverage_days": row["stockCoverageDays"],
            "selected_model": row["selectedModel"],
            "model_parameters": json.dumps(row["modelParameters"], default=str) if row.get("modelParameters") else None,
            "mae": row.get("MAE"),
            "rmse": row.get("RMSE"),
            "wape": row.get("WAPE"),
            "accuracy_score": row["accuracyScore"],
            "reliability_level": row["reliabilityLevel"],
            "prediction_reason": row["predictionReason"],
            "status": row["status"],
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        })
    db.commit()

import pytest
import pandas as pd
import numpy as np
from datetime import date, timedelta

from app.services.recommendation_engine import calculate_recommendation
from app.services.explanation_engine import generate_forecast_explanation
from app.services.backtesting import calculate_monthly_wape, calculate_monthly_bias, run_backtest_on_product
from app.services.model_selector import select_best_model
from app.services.product_profiler import classify_product_demand
from app.services.feature_engineering import reconstruct_stock_history, calculate_product_features
from app.services.data_cleaner import clean_and_merge_data
from app.models.seasonal_naive import SeasonalNaiveModel
from app.models.moving_average import MovingAverageModel
from app.models.linear_regression import LinearRegressionModel
from app.models.croston import CrostonModel

# 1. Historical Backtesting Test (No target-month data leakage)
def test_historical_backtesting():
    records = []
    # Train months: Jan (100), Feb (110), Mar (120), Apr (130), May (140)
    for m, days in [(1, 31), (2, 28), (3, 31), (4, 30), (5, 31)]:
        daily_val = 100 / days if m == 1 else (110/28 if m==2 else (120/31 if m==3 else (130/30 if m==4 else 140/31)))
        for d in range(1, days + 1):
            cur_d = date(2026, m, d)
            records.append({
                "date": cur_d,
                "net_qty_sold": float(daily_val),
                "month": m,
                "year": 2026,
                "dayOfWeek": cur_d.weekday(),
                "weekendFlag": 1 if cur_d.weekday() in [5, 6] else 0,
                "average_unit_price": 10.0,
                "discount_applied": 0,
                "discount_percentage": 0.0
            })
    df = pd.DataFrame(records)
    
    # Backtest with n_windows=1 should evaluate May strictly using history up to April
    results = run_backtest_on_product(df, target_month=5, n_windows=1)
    assert "Moving Average" in results
    assert results["Moving Average"]["window_count"] == 1

# 2. Monthly WAPE Test
def test_monthly_wape():
    actual_monthly = np.array([120.0, 135.0, 128.0])
    predicted_monthly = np.array([130.0, 140.0, 120.0])
    # Sum(|Actual - Pred|) = |120-130| + |135-140| + |128-120| = 10 + 5 + 8 = 23
    # Sum(Actual) = 120 + 135 + 128 = 383
    # WAPE = 23 / 383 = 0.060052
    wape = calculate_monthly_wape(actual_monthly, predicted_monthly)
    assert round(wape, 4) == round(23.0 / 383.0, 4)

# 3. Monthly Bias Test
def test_monthly_bias():
    actual_monthly = np.array([130.0])
    predicted_monthly = np.array([140.0])
    bias = calculate_monthly_bias(actual_monthly, predicted_monthly)
    assert bias == 10.0

# 4. Final Monthly Prediction Test
def test_final_monthly_prediction():
    history_records = []
    start_d = date(2025, 1, 1)
    for i in range(180):
        d = start_d + timedelta(days=i)
        history_records.append({
            "date": d,
            "net_qty_sold": 4.5,
            "month": d.month,
            "year": d.year,
            "dayOfWeek": d.weekday(),
            "weekendFlag": 1 if d.weekday() in [5, 6] else 0,
            "average_unit_price": 10.0,
            "discount_applied": False,
            "discount_percentage": 0.0
        })
    df = pd.DataFrame(history_records)
    model_name, params, mae, rmse, wape, accuracy, reliability, model_instance = select_best_model(df, "STABLE", 7)
    
    future_dates = pd.date_range(date(2025, 7, 1), date(2025, 7, 31)).date
    future_df = pd.DataFrame([{"date": d, "dayOfWeek": d.weekday(), "month": d.month, "year": d.year, "weekendFlag": 1 if d.weekday() in [5,6] else 0, "average_unit_price": 10.0, "discount_applied": 0, "discount_percentage": 0.0} for d in future_dates])
    
    preds = model_instance.predict(future_df)
    predicted_monthly_demand = int(round(np.sum(preds)))
    assert predicted_monthly_demand > 0

# 5. Coverage Calculation Test
def test_coverage_calculation():
    predicted_monthly_demand = 137
    month_days = 30
    current_stock = 100
    avg_daily_demand = predicted_monthly_demand / month_days # 4.5667
    coverage = current_stock / avg_daily_demand
    assert round(avg_daily_demand, 4) == round(137.0 / 30.0, 4)
    assert round(coverage, 1) == 21.9

# 6. Zero Demand Test
def test_zero_demand():
    safety, required, recommended, coverage, status, stock_vs_req_pct, avg_daily = calculate_recommendation(
        predicted_demand=0,
        current_stock=50,
        safety_stock_pct=0.15,
        confirmed_incoming_stock=0,
        target_month_days=30
    )
    assert safety == 0
    assert required == 0
    assert recommended == 0
    assert coverage == 999.0 # Safe large representation (>90 days)
    assert avg_daily == 0.0
    assert status in ["SUFFICIENT", "OVERSTOCK_RISK"]

# 7. Reorder Required Test
def test_reorder_required():
    # Predicted = 127, Safety = 20, Required = 147, Current = 64, Order = 83
    safety, required, recommended, coverage, status, stock_vs_req_pct, avg_daily = calculate_recommendation(
        predicted_demand=127,
        current_stock=64,
        safety_stock_pct=0.15,
        target_month_days=30
    )
    assert safety == 20
    assert required == 147
    assert recommended == 83
    assert status == "REORDER_REQUIRED"

# 8. Sufficient Test
def test_sufficient_status():
    # Predicted = 137, Safety = 21, Required = 158, Current = 183, Order = 0
    safety, required, recommended, coverage, status, stock_vs_req_pct, avg_daily = calculate_recommendation(
        predicted_demand=137,
        current_stock=183,
        safety_stock_pct=0.15,
        target_month_days=31
    )
    assert safety == 21
    assert required == 158
    assert recommended == 0
    assert status == "SUFFICIENT"

# 9. Overstock Test
def test_overstock_status():
    # Predicted = 126, Safety = 19, Required = 145, Current = 268, Estimated Coverage > 45 days
    safety, required, recommended, coverage, status, stock_vs_req_pct, avg_daily = calculate_recommendation(
        predicted_demand=126,
        current_stock=268,
        safety_stock_pct=0.15,
        target_month_days=30
    )
    assert safety == 19
    assert required == 145
    assert coverage > 45.0
    assert status == "OVERSTOCK_RISK"

# 10. Low Confidence Test
def test_low_confidence():
    analysis_row = {
        "productId": "SKU-LOW-CONF",
        "dataQuality": "LIMITED",
        "recentGrowthPercentage": 0.0,
        "discountUpliftPercentage": 0.0,
        "stockOutDays": 0,
        "completeHistoryMonths": 2
    }
    explanation = generate_forecast_explanation(
        analysis_row=analysis_row,
        predicted_demand=100,
        current_stock=10,
        safety_stock=15,
        recommended_qty=105,
        stock_coverage=3.0,
        status="CRITICAL_ACTION",
        selected_model="Moving Average",
        wape_score=0.55,
        target_month_name="August",
        safety_stock_pct=0.15,
        reliability_level="LOW",
        stock_vs_required_pct=8.7
    )
    assert "low-confidence monthly forecast" in explanation
    assert "Manager review is recommended" in explanation

# 11. Limited History Fallback Accuracy Scaling Test (0-100 scale)
def test_limited_history_accuracy_scale():
    # When product has limited history (<45 days or LIMITED_HISTORY behavior)
    records = []
    start_d = date(2025, 6, 1)
    for i in range(20): # only 20 days of data (< 45 days)
        d = start_d + timedelta(days=i)
        records.append({
            "date": d,
            "net_qty_sold": 5.0,
            "month": d.month,
            "year": d.year,
            "dayOfWeek": d.weekday(),
            "weekendFlag": 1 if d.weekday() in [5, 6] else 0,
            "average_unit_price": 10.0,
            "discount_applied": False,
            "discount_percentage": 0.0
        })
    df = pd.DataFrame(records)
    model_name, params, mae, rmse, wape, accuracy, reliability, model_instance = select_best_model(df, "LIMITED_HISTORY", 7)
    
    assert model_name == "Moving Average"
    assert wape == 0.50
    # Must be 50.0 on 0-100 scale, NOT 0.50
    assert accuracy == 50.0
    assert reliability == "LOW"


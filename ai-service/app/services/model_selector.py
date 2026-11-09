import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple
from app.services.backtesting import run_backtest_on_product
from app.models.seasonal_naive import SeasonalNaiveModel
from app.models.moving_average import MovingAverageModel
from app.models.linear_regression import LinearRegressionModel
from app.models.random_forest import RandomForestModel
from app.models.gradient_boosting import GradientBoostingModel
from app.models.croston import CrostonModel

def select_best_model(
    product_history: pd.DataFrame,
    primary_behaviour: str,
    target_month: int
) -> Tuple[str, Dict[str, Any], float, float, float, float, str, Any]:
    """
    Evaluates candidate models via walk-forward backtesting.
    Filters candidate models dynamically based on demand behavior.
    Selects the best model and returns its parameters, error metrics, reliability, and fitted instance.
    """
    n_days = len(product_history)
    
    # 1. Fallback for Limited History
    if primary_behaviour == "LIMITED_HISTORY" or n_days < 45:
        # Limited history fallback: use simple Moving Average (30-day window)
        model_name = "Moving Average"
        model_params = {"window_days": 30}
        model_instance = MovingAverageModel(window_days=30).fit(product_history)
        
        # Default metrics for limited data
        mae = 0.0
        rmse = 0.0
        wape = 0.50
        accuracy = 50.0
        reliability = "LOW"
        
        return model_name, model_params, mae, rmse, wape, accuracy, reliability, model_instance

    # 2. Run walk-forward validation
    backtest_errs = run_backtest_on_product(product_history, target_month, n_windows=3)
    
    # 3. Filter candidate models by demand profile
    eligible_models = ["Moving Average"] # Always keep at least one simple baseline
    
    if primary_behaviour == "STABLE":
        eligible_models.extend(["Linear Regression", "Random Forest"])
    elif primary_behaviour == "SEASONAL":
        eligible_models.extend(["Seasonal Naive", "Random Forest", "Gradient Boosting"])
    elif primary_behaviour in ["TRENDING_UP", "TRENDING_DOWN"]:
        eligible_models.extend(["Linear Regression", "Random Forest", "Gradient Boosting"])
    elif primary_behaviour == "INTERMITTENT":
        eligible_models.extend(["Croston"])
    elif primary_behaviour == "HIGH_VARIABILITY":
        eligible_models.extend(["Random Forest", "Gradient Boosting"])
    else:
        eligible_models.extend(["Seasonal Naive", "Linear Regression", "Random Forest", "Gradient Boosting"])

    best_model_name = "Moving Average"
    best_wape = 999.0
    
    for model_name in eligible_models:
        if model_name in backtest_errs:
            wape = backtest_errs[model_name]["WAPE"]
            if wape < best_wape:
                best_wape = wape
                best_model_name = model_name

    # 4. Parsimonious rule: complex models must beat Moving Average baseline by at least 5% WAPE
    baseline_wape = backtest_errs.get("Moving Average", {}).get("WAPE", 999.0)
    
    if best_model_name in ["Random Forest", "Gradient Boosting"] and baseline_wape != 999.0:
        # If relative improvement is less than 5%
        if best_wape >= baseline_wape * 0.95:
            best_model_name = "Moving Average"
            best_wape = baseline_wape

    # 5. Extract selected model's metrics
    model_metrics = backtest_errs.get(best_model_name, {"WAPE": 0.50, "MAE": 0.0, "RMSE": 0.0, "Bias": 0.0, "stability": 0.0})
    wape = model_metrics.get("WAPE", 0.50)
    mae = model_metrics.get("MAE", 0.0)
    rmse = model_metrics.get("RMSE", 0.0)
    bias = model_metrics.get("Bias", 0.0)
    stability = model_metrics.get("stability", 0.0)
    
    # Accuracy score = max(0, 100 - WAPE_pct)
    accuracy_score = max(0.0, 100.0 - (wape * 100.0))
    
    # 6. Fit the selected model on the entire historical dataset
    if best_model_name == "Seasonal Naive":
        model_params = {"target_month": target_month, "monthlyBias": bias}
        model_instance = SeasonalNaiveModel().fit(product_history, target_month)
    elif best_model_name == "Linear Regression":
        model_params = {"window_days": 180, "monthlyBias": bias}
        model_instance = LinearRegressionModel(window_days=180).fit(product_history)
    elif best_model_name == "Random Forest":
        model_params = {"n_estimators": 50, "max_depth": 6, "random_state": 42, "monthlyBias": bias}
        model_instance = RandomForestModel().fit(product_history)
    elif best_model_name == "Gradient Boosting":
        model_params = {"n_estimators": 50, "max_depth": 4, "learning_rate": 0.1, "random_state": 42, "monthlyBias": bias}
        model_instance = GradientBoostingModel().fit(product_history)
    elif best_model_name == "Croston":
        model_params = {"alpha": 0.15, "monthlyBias": bias}
        model_instance = CrostonModel(alpha=0.15).fit(product_history)
    else:
        best_model_name = "Moving Average"
        model_params = {"window_days": 90, "monthlyBias": bias}
        model_instance = MovingAverageModel(window_days=90).fit(product_history)

    # 7. Reliability level assignment based on monthly backtesting metrics
    zero_sales_ratio = float((product_history["net_qty_sold"] == 0).sum() / max(1, len(product_history)))
    
    if wape <= 0.20 and stability <= 0.10 and n_days >= 180 and zero_sales_ratio < 0.50:
        reliability = "HIGH"
    elif wape >= 0.50 or n_days < 90 or stability > 0.25:
        reliability = "LOW"
    else:
        reliability = "MEDIUM"

    return best_model_name, model_params, mae, rmse, wape, accuracy_score, reliability, model_instance

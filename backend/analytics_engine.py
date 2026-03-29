import statistics
from typing import List, Dict, Any

def calculate_ewma(series: List[float], alpha: float = 0.4) -> float:
    """
    Computes Exponentially Weighted Moving Average.
    Higher alpha (e.g. 0.4-0.6) reacts faster to recent changes, 
    useful for small street vendor datasets.
    """
    if not series:
        return 0.0
    ewma = series[0]
    for x in series[1:]:
        ewma = alpha * x + (1 - alpha) * ewma
    return ewma

def detect_mad_anomalies(series: List[float], threshold: float = 3.5) -> List[int]:
    """
    Robust anomaly detection using Median Absolute Deviation (MAD).
    Returns list of indices that are outliers.
    """
    if len(series) < 3:
        return []
    
    median = statistics.median(series)
    abs_dev = [abs(x - median) for x in series]
    mad = statistics.median(abs_dev)
    
    if mad == 0:
        return []
        
    anomalies = []
    for i, x in enumerate(series):
        if abs(x - median) > threshold * mad:
            anomalies.append(i)
    return anomalies

def estimate_counterfactual_demand(observed: float, baseline: float, stockout: bool = False, lost_sales: bool = False) -> Dict[str, Any]:
    """
    Section 2 & 3: Corrects observed sales for demand constraints.
    """
    estimated = observed
    reason_key = "reason_normal"
    
    if stockout:
        estimated = max(observed, baseline * 1.2)
        reason_key = "reason_stockout"
    
    if lost_sales:
        estimated = baseline * 1.3
        reason_key = "reason_lost_sales"
        
    lost_count = max(0, estimated - observed)
    
    return {
        "estimated_demand": estimated,
        "lost_sales": lost_count,
        "reason_key": reason_key
    }

def generate_business_suggestions(item_name: str, estimated_demand: float, observed_sales: float, trend: str, stockout_freq: float) -> Dict[str, Any]:
    """
    Section 7: Strategic next-day prep suggestions using i18n keys.
    """
    key = "maintain_prep"
    percentage = 0
    reason_key = "reason_stable"
    
    # Rules
    if (estimated_demand > observed_sales) or (stockout_freq > 0.5):
        percentage = 30
        key = "increase_prep"
        reason_key = "reason_strong_demand"
    elif trend == "up":
        percentage = 15
        key = "increase_prep"
        reason_key = "reason_trend_rising"
    elif trend == "down":
        key = "reduce_prep"
        percentage = 10
        reason_key = "reason_trend_falling"
        
    return {
        "item": item_name,
        "percentage": percentage,
        "suggestion_key": key,
        "reason_key": reason_key
    }

def get_scheme_recommendation(monthly_profit: float, revenue: float, stall_data: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Evaluates business performance against govt scheme criteria using i18n keys.
    """
    scheme = {
        "scheme_key": "pm_svanidhi",
        "name": "PM SVANidhi Scheme",
        "link": "pmsvanidhi.mohua.gov.in",
        "benefit": "Micro-credit up to ₹50,000",
        "reason_key": "pm_svanidhi_reason"
    }
    
    if monthly_profit > 25000:
        scheme = {
            "scheme_key": "mudra_loan",
            "name": "PMMY Mudra Loan",
            "link": "mudra.org.in",
            "benefit": "Business expansion loan up to ₹5 Lakh",
            "reason_key": "mudra_loan_reason"
        }
    elif revenue > 50000:
         scheme = {
            "scheme_key": "shishu_loan",
            "name": "Mudra Yojana (Shishu)",
            "link": "mudra.org.in",
            "benefit": "Capital loan up to ₹50,000",
            "reason_key": "shishu_loan_reason"
        }
        
    return scheme

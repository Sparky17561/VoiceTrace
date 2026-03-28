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
    reason = "Normal sales"
    
    if stockout:
        estimated = max(observed, baseline * 1.2)
        reason = "Early stockout detected; demand estimated at 120% of baseline."
    
    if lost_sales:
        estimated = baseline * 1.3
        reason = "Customers were turned away; demand estimated at 130% of baseline."
        
    lost_count = max(0, estimated - observed)
    
    return {
        "estimated_demand": estimated,
        "lost_sales": lost_count,
        "reason": reason
    }

def generate_business_suggestions(item_name: str, estimated_demand: float, observed_sales: float, trend: str, stockout_freq: float) -> Dict[str, Any]:
    """
    Section 7: Strategic next-day prep suggestions.
    """
    suggestion = "Maintain current levels."
    percentage = 0
    reason = "Sales are stable."
    
    # Rules
    if (estimated_demand > observed_sales) or (stockout_freq > 0.5):
        percentage = 30
        suggestion = f"Increase {item_name} preparation by ~{percentage}% tomorrow."
        reason = "Strong demand often outstrips your current stock."
    elif trend == "up":
        percentage = 15
        suggestion = f"Increase {item_name} preparation by ~{percentage}% tomorrow."
        reason = "Sales trend is rising; prepare for higher volume."
    elif trend == "down":
        percentage = -10
        suggestion = f"Reduce {item_name} preparation by ~10% tomorrow."
        reason = "Recent interest in this item is cooling off."
        
    return {
        "suggestion": suggestion,
        "percentage": percentage,
        "reason": reason
    }

def get_scheme_recommendation(monthly_profit: float, revenue: float, stall_data: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Evaluates business performance against govt scheme criteria.
    """
    primary = {
        "name": "PM SVANidhi Scheme",
        "link": "pmsvanidhi.mohua.gov.in",
        "benefit": "Micro-credit up to ₹50,000",
        "reason": "Since your monthly profit is currently growing, this lower-interest credit can help you secure daily supplies without a middleman."
    }
    
    if monthly_profit > 25000:
        primary = {
            "name": "Pradhan Mantri Mudra Yojana (PMMY)",
            "link": "mudra.org.in",
            "benefit": "Business expansion loan up to ₹5 Lakh (Kishore)",
            "reason": "With a monthly profit of over ₹25,000, you qualify for expansion-tier loans to add more stalls or a larger space."
        }
    elif revenue > 50000:
         primary = {
            "name": "Mudra Yojana (Shishu)",
            "link": "mudra.org.in",
            "benefit": "Capital loan up to ₹50,000",
            "reason": "Your high revenue suggests high inventory turnover. This loan can help you buy bulk at lower prices."
        }
        
    return primary

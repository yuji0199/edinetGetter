import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from schemas import GrowthSeriesItem, GrowthAnalysisResponse
from dataclasses import dataclass

@dataclass
class PeriodData:
    year: str
    sales: float
    operating_income: float
    ordinary_income: float
    net_income: float
    dividend: float
    operating_cf: float
    investing_cf: float

def calculate_growth_for_stock(db: Session, stock_id: int, years: int = 5) -> GrowthAnalysisResponse:
    # 2. Get financial documents (limit to 'years' count + 1 for YoY)
    docs = db.query(models.FinancialDocument).filter(
        models.FinancialDocument.stock_id == stock_id
    ).order_by(models.FinancialDocument.period_end.desc(), models.FinancialDocument.submit_datetime.desc()).all()

    if not docs:
        return GrowthAnalysisResponse(series=[], cagr_sales=0, cagr_profit=0)

    # 3. Organize data by period end date to avoid duplicates
    period_data: List[PeriodData] = []
    seen_years = set()
    
    for doc in docs:
        metrics = json.loads(doc.metrics_json) if doc.metrics_json else {}
        ref_date = doc.period_end or doc.submit_datetime
        year_str = str(ref_date.year) if ref_date else "Unknown"
        
        if year_str not in seen_years:
            seen_years.add(year_str)
            period_data.append(PeriodData(
                year=year_str,
                sales=float(metrics.get("net_sales") or 0),
                operating_income=float(metrics.get("operating_income") or 0),
                ordinary_income=float(metrics.get("ordinary_income") or 0),
                net_income=float(metrics.get("net_income") or 0),
                dividend=float(metrics.get("dividends_paid") or 0),
                operating_cf=float(metrics.get("operating_cf") or 0),
                investing_cf=float(metrics.get("investing_cf") or 0)
            ))
            if len(seen_years) >= years + 1:
                break

    # Sort by year ascending for calculation
    period_data.sort(key=lambda x: x.year)

    # 4. Calculate YoY and CAGR
    series: List[GrowthSeriesItem] = []
    for i in range(len(period_data)):
        curr = period_data[i]
        item_dict = {
            "year": curr.year,
            "sales": curr.sales,
            "operating_income": curr.operating_income,
            "ordinary_income": curr.ordinary_income,
            "net_income": curr.net_income,
            "dividend": curr.dividend,
            "operating_cf": curr.operating_cf,
            "fcf": curr.operating_cf + curr.investing_cf,
            "sales_growth": 0.0,
            "profit_growth": 0.0,
            "ordinary_growth": 0.0,
            "net_income_growth": 0.0,
            "dividend_growth": 0.0,
            "operating_cf_growth": 0.0,
            "fcf_growth": 0.0
        }

        if i > 0:
            prev = period_data[i-1]
            def calc_growth(c: float, p: float) -> float:
                return float(round(((c - p) / abs(p)) * 100, 2)) if p and p != 0 else 0.0

            item_dict["sales_growth"] = calc_growth(curr.sales, prev.sales)
            item_dict["profit_growth"] = calc_growth(curr.operating_income, prev.operating_income)
            item_dict["ordinary_growth"] = calc_growth(curr.ordinary_income, prev.ordinary_income)
            item_dict["net_income_growth"] = calc_growth(curr.net_income, prev.net_income)
            item_dict["dividend_growth"] = calc_growth(curr.dividend, prev.dividend)
            item_dict["operating_cf_growth"] = calc_growth(curr.operating_cf, prev.operating_cf)
            
            curr_fcf = curr.operating_cf + curr.investing_cf
            prev_fcf = prev.operating_cf + prev.investing_cf
            item_dict["fcf_growth"] = calc_growth(curr_fcf, prev_fcf)
        
        series.append(GrowthSeriesItem(**item_dict))

    # Calculate CAGR
    cagr_sales = 0.0
    cagr_profit = 0.0
    if len(series) >= 2:
        first = series[0]
        last = series[-1]
        n_years = len(series) - 1
        
        def calc_cagr(v_last: float, v_first: float, n: int) -> float:
            if v_first > 0 and v_last > 0 and n > 0:
                return float(round(((v_last / v_first) ** (1/n) - 1) * 100, 2))
            return 0.0

        cagr_sales = calc_cagr(last.sales, first.sales, n_years)
        cagr_profit = calc_cagr(last.operating_income, first.operating_income, n_years)

    return GrowthAnalysisResponse(
        series=list(reversed(series))[:years],
        cagr_sales=cagr_sales,
        cagr_profit=cagr_profit,
        latest=series[-1] if series else None
    )

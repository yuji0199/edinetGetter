import json
from datetime import datetime, timezone
from typing import List, Dict, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from schemas import GrowthSeriesItem, GrowthAnalysisResponse
from dataclasses import dataclass

@dataclass
class PeriodFinancialData:
    """計算用に正規化された会計年度ごとの財務データ"""
    year: str
    sales: float
    operating_income: float
    ordinary_income: float
    net_income: float
    dividend: float
    operating_cf: float
    investing_cf: float

def calculate_growth_for_stock(db: Session, stock_id: int, years: int = 5) -> GrowthAnalysisResponse:
    """
    指定された銘柄の過去数年分の成長率（YoY, CAGR）を算出する。
    
    会計期間（period_end）をキーとしてデータを名寄せし、
    歯抜けや重複を排除した年度推移データを基に計算を行う。
    """
    
    # 成長率の算出には最低2期間（当年と前年）が必要なため、
    # 画面表示件数（years）に比較用の1年分を加味してデータを取得する
    query_limit = years + 1
    docs = db.query(models.FinancialDocument).filter(
        models.FinancialDocument.stock_id == stock_id
    ).order_by(
        models.FinancialDocument.period_end.desc(),
        models.FinancialDocument.submit_datetime.desc()
    ).all()

    if not docs:
        return GrowthAnalysisResponse(series=[], cagr_sales=0, cagr_profit=0)

    # 同一会計年度のデータが複数存在する場合（訂正報告書など）、最新のものを優先して名寄せする
    period_data_list: List[PeriodFinancialData] = []
    seen_years: Set[str] = set()
    
    for doc in docs:
        metrics = json.loads(doc.metrics_json) if doc.metrics_json else {}
        # 報告日ではなく、実際の決算期末日を基準として年度（FY）を特定する
        reference_date = doc.period_end or doc.submit_datetime
        if reference_date:
            if reference_date.month <= 3:
                year_string = str(reference_date.year - 1)
            else:
                year_string = str(reference_date.year)
        else:
            year_string = "Unknown"
        
        if year_string not in seen_years:
            seen_years.add(year_string)
            period_data_list.append(PeriodFinancialData(
                year=year_string,
                sales=float(metrics.get("net_sales") or 0),
                operating_income=float(metrics.get("operating_income") or 0),
                ordinary_income=float(metrics.get("ordinary_income") or 0),
                net_income=float(metrics.get("net_income") or 0),
                dividend=float(metrics.get("dividends_paid") or 0),
                operating_cf=float(metrics.get("operating_cf") or 0),
                investing_cf=float(metrics.get("investing_cf") or 0)
            ))
            if len(seen_years) >= query_limit:
                break

    # 時系列順（古い順）に並べ替えて成長率の算出準備を整える
    period_data_list.sort(key=lambda x: x.year)

    # 年度ごとの成長率（YoY）を算出し、レスポンス形式に変換する
    calculated_series: List[GrowthSeriesItem] = []
    for index in range(len(period_data_list)):
        current = period_data_list[index]
        # フリーキャッシュフロー(FCF)は事業から得た現金と投資に回した現金の合計として算出
        current_fcf = current.operating_cf + current.investing_cf
        
        growth_item = {
            "year": current.year,
            "sales": current.sales,
            "operating_income": current.operating_income,
            "ordinary_income": current.ordinary_income,
            "net_income": current.net_income,
            "dividend": current.dividend,
            "operating_cf": current.operating_cf,
            "fcf": current_fcf,
            "sales_growth": 0.0,
            "profit_growth": 0.0,
            "ordinary_growth": 0.0,
            "net_income_growth": 0.0,
            "dividend_growth": 0.0,
            "operating_cf_growth": 0.0,
            "fcf_growth": 0.0
        }

        # 前年度のデータが存在する場合のみ、対前年比成長率を計算する
        if index > 0:
            previous = period_data_list[index - 1]
            previous_fcf = previous.operating_cf + previous.investing_cf
            
            def calculate_percentage_growth(current_val: float, previous_val: float) -> float:
                """ゼロ除算を回避しつつ成長率を算出する内部関数"""
                if previous_val and previous_val != 0:
                    # 成長率(%) = (当年 - 前年) / |前年| * 100
                    return float(round(((current_val - previous_val) / abs(previous_val)) * 100, 2))
                return 0.0

            growth_item["sales_growth"] = calculate_percentage_growth(current.sales, previous.sales)
            growth_item["profit_growth"] = calculate_percentage_growth(current.operating_income, previous.operating_income)
            growth_item["ordinary_growth"] = calculate_percentage_growth(current.ordinary_income, previous.ordinary_income)
            growth_item["net_income_growth"] = calculate_percentage_growth(current.net_income, previous.net_income)
            growth_item["dividend_growth"] = calculate_percentage_growth(current.dividend, previous.dividend)
            growth_item["operating_cf_growth"] = calculate_percentage_growth(current.operating_cf, previous.operating_cf)
            growth_item["fcf_growth"] = calculate_percentage_growth(current_fcf, previous_fcf)
        
        calculated_series.append(GrowthSeriesItem(**growth_item))

    # 年平均成長率（CAGR）を算出する。
    # 算式: ((最新の値 / 最初の値) ^ (1 / 年数)) - 1
    cagr_sales = 0.0
    cagr_profit = 0.0
    if len(calculated_series) >= 2:
        first_period = calculated_series[0]
        last_period = calculated_series[-1]
        elapsed_years = len(calculated_series) - 1
        
        def calculate_cagr(final_value: float, initial_value: float, num_years: int) -> float:
            """値が正の場合にのみ幾何平均成長率を算出する。負の値が含まれる場合は0を返す。"""
            if initial_value > 0 and final_value > 0 and num_years > 0:
                return float(round(((final_value / initial_value) ** (1 / num_years) - 1) * 100, 2))
            return 0.0

        cagr_sales = calculate_cagr(last_period.sales, first_period.sales, elapsed_years)
        cagr_profit = calculate_cagr(last_period.operating_income, first_period.operating_income, elapsed_years)

    # フロントエンドでの表示順（新しい順）に並べ替えて返却する
    return GrowthAnalysisResponse(
        series=list(reversed(calculated_series))[:years],
        cagr_sales=cagr_sales,
        cagr_profit=cagr_profit,
        latest=calculated_series[-1] if calculated_series else None
    )

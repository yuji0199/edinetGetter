from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import database, models, schemas
from services.growth import calculate_growth_for_stock
from schemas import GrowthAnalysisResponse

router = APIRouter(prefix="/stocks", tags=["growth"])

@router.get("/{securities_code}/growth", response_model=GrowthAnalysisResponse)
def get_growth_analysis(securities_code: str, years: int = 5, db: Session = Depends(database.get_db)):
    """
    指定された証券コードの銘柄について、過去数年間の成長性分析データを取得する。
    
    内部的に `calculate_growth_for_stock` を呼び出し、
    有価証券報告書から抽出された財務データに基づきYoY成長率およびCAGRを算出する。
    """
    
    # 指定されたコードが存在するかを確認し、存在しない場合は404エラーを返却（Early Return）
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="指定された証券コードの銘柄が見つかりません。")
    
    # 銘柄IDを基に、指定された年数分の成長性データを計算して返却
    return calculate_growth_for_stock(db, stock.id, years)

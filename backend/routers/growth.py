from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import database, models, schemas
from services.growth import calculate_growth_for_stock
from schemas import GrowthAnalysisResponse

router = APIRouter(prefix="/stocks", tags=["growth"])

@router.get("/{securities_code}/growth", response_model=GrowthAnalysisResponse)
def get_growth_analysis(securities_code: str, years: int = 5, db: Session = Depends(database.get_db)):
    # 1. Get stock
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # 2. Calculate growth
    return calculate_growth_for_stock(db, stock.id, years)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import models, schemas, database
from routers.auth import get_current_user

router = APIRouter(prefix="/stocks", tags=["stocks"])

@router.get("/", response_model=List[schemas.StockResponse])
def read_stocks(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    stocks = db.query(models.Stock).offset(skip).limit(limit).all()
    return stocks

@router.get("/{securities_code}", response_model=schemas.StockDetailResponse)
def read_stock(securities_code: str, db: Session = Depends(database.get_db)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    current_price, per, pbr = None, None, None
    try:
        import yfinance as yf
        import json
        
        code_4digit = stock.securities_code[:4]
        ticker = yf.Ticker(f"{code_4digit}.T")
        current_price = ticker.info.get('currentPrice') or ticker.info.get('regularMarketPrice')
        
        latest_doc = db.query(models.FinancialDocument).filter(
            models.FinancialDocument.stock_id == stock.id
        ).order_by(models.FinancialDocument.submit_datetime.desc()).first()
        
        if current_price and latest_doc and latest_doc.metrics_json:
            metrics = json.loads(latest_doc.metrics_json)
            eps = metrics.get('eps')
            bps = metrics.get('bps')
            if eps and eps > 0:
                per = current_price / eps
            if bps and bps > 0:
                pbr = current_price / bps
    except Exception as e:
        print(f"yfinance calculation error for {securities_code}: {e}")
        pass

    return {
        "id": stock.id,
        "securities_code": stock.securities_code,
        "company_name": stock.company_name,
        "industry": stock.industry,
        "updated_at": stock.updated_at,
        "current_price": current_price,
        "per": per,
        "pbr": pbr
    }

@router.get("/{securities_code}/documents", response_model=List[schemas.FinancialDocumentResponse])
def get_stock_documents(securities_code: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    docs = db.query(models.FinancialDocument).options(joinedload(models.FinancialDocument.stock)).filter(models.FinancialDocument.stock_id == stock.id).order_by(models.FinancialDocument.id.asc()).all()
    return docs

@router.post("/", response_model=schemas.StockResponse)
def create_stock(stock: schemas.StockBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_stock = db.query(models.Stock).filter(models.Stock.securities_code == stock.securities_code).first()
    if db_stock:
        raise HTTPException(status_code=400, detail="Stock already registered")
    
    new_stock = models.Stock(**stock.model_dump())
    db.add(new_stock)
    db.commit()
    db.refresh(new_stock)
    return new_stock

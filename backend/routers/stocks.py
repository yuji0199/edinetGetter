from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from typing import List
import os
import uuid
import models, schemas, database
from routers.auth import get_current_user

router = APIRouter(prefix="/stocks", tags=["stocks"])

@router.get("/", response_model=List[schemas.StockResponse])
def read_stocks(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    stocks = db.query(models.Stock).offset(skip).limit(limit).all()
    return stocks

@router.get("/search", response_model=List[schemas.StockResponse])
def search_stocks(query: str = "", db: Session = Depends(database.get_db)):
    """検索機能（衝突回避のため引数を任意に）"""
    if not query: return []
    return db.query(models.Stock).filter(
        (models.Stock.securities_code.like(f"{query}%")) |
        (models.Stock.company_name.like(f"%{query}%"))
    ).limit(10).all()

@router.get("/{securities_code}", response_model=schemas.StockDetailResponse)
def read_stock(securities_code: str, db: Session = Depends(database.get_db)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
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

@router.get("/{securities_code}/forecast", response_model=schemas.UserStockForecastResponse)
def get_user_stock_forecast(securities_code: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    forecast = db.query(models.UserStockForecast).filter(
        models.UserStockForecast.user_id == current_user.id,
        models.UserStockForecast.stock_id == stock.id
    ).first()
    
    if not forecast:
        raise HTTPException(status_code=404, detail="Forecast not found")
        
    return forecast

@router.put("/{securities_code}/forecast", response_model=schemas.UserStockForecastResponse)
def update_user_stock_forecast(securities_code: str, forecast_data: schemas.UserStockForecastCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    forecast = db.query(models.UserStockForecast).filter(
        models.UserStockForecast.user_id == current_user.id,
        models.UserStockForecast.stock_id == stock.id
    ).first()
    
    if forecast:
        # Update existing
        for key, value in forecast_data.model_dump().items():
            setattr(forecast, key, value)
    else:
        # Create new
        forecast = models.UserStockForecast(
            user_id=current_user.id,
            stock_id=stock.id,
            **forecast_data.model_dump()
        )
        db.add(forecast)
        
    db.commit()
    db.refresh(forecast)
    return forecast

@router.get("/{securities_code}/notes", response_model=List[schemas.UserStockNoteResponse])
def get_user_stock_notes(securities_code: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    notes = db.query(models.UserStockNote).filter(
        models.UserStockNote.user_id == current_user.id,
        models.UserStockNote.stock_id == stock.id
    ).order_by(models.UserStockNote.created_at.desc()).all()
    
    return notes

@router.post("/{securities_code}/notes", response_model=schemas.UserStockNoteResponse)
def create_user_stock_note(securities_code: str, content: str = Form(...), image: UploadFile = File(None), db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    image_path = None
    if image and image.filename:
        # Save the uploaded file to backend/uploads
        ext = os.path.splitext(image.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as buffer:
            buffer.write(image.file.read())
            
        image_path = f"/uploads/{filename}"

    new_note = models.UserStockNote(
        user_id=current_user.id,
        stock_id=stock.id,
        content=content,
        image_path=image_path
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@router.delete("/{securities_code}/notes/{note_id}")
def delete_user_stock_note(securities_code: str, note_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    note = db.query(models.UserStockNote).filter(
        models.UserStockNote.id == note_id,
        models.UserStockNote.user_id == current_user.id,
        models.UserStockNote.stock_id == stock.id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}

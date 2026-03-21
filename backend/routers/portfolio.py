from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import database
from routers.auth import get_current_user

router = APIRouter(
    prefix="/portfolios",
    tags=["Portfolios"]
)

@router.get("/", response_model=List[schemas.PortfolioResponse])
def get_portfolios(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    portfolios = db.query(models.Portfolio).filter(models.Portfolio.user_id == current_user.id).all()
    return portfolios

@router.post("/", response_model=schemas.PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    portfolio: schemas.PortfolioCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_portfolio = models.Portfolio(
        user_id=current_user.id,
        name=portfolio.name,
        description=portfolio.description
    )
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    return db_portfolio

@router.get("/{portfolio_id}", response_model=schemas.PortfolioResponse)
def get_portfolio(
    portfolio_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio

@router.put("/{portfolio_id}", response_model=schemas.PortfolioResponse)
def update_portfolio(
    portfolio_id: int,
    portfolio_update: schemas.PortfolioCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
        
    portfolio.name = portfolio_update.name
    portfolio.description = portfolio_update.description
    
    db.commit()
    db.refresh(portfolio)
    return portfolio

@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
        
    db.delete(portfolio)
    db.commit()
    return

@router.post("/{portfolio_id}/items", response_model=schemas.PortfolioItemResponse, status_code=status.HTTP_201_CREATED)
def add_portfolio_item(
    portfolio_id: int,
    item: schemas.PortfolioItemCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
        
    # Check if stock exists
    stock = db.query(models.Stock).filter(models.Stock.id == item.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    # Check if item already exists in this portfolio
    existing_item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.portfolio_id == portfolio_id,
        models.PortfolioItem.stock_id == item.stock_id
    ).first()
    
    if existing_item:
        raise HTTPException(status_code=400, detail="Stock already exists in this portfolio")
        
    db_item = models.PortfolioItem(
        portfolio_id=portfolio_id,
        stock_id=item.stock_id,
        notes=item.notes,
        target_price=item.target_price
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{portfolio_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_item(
    portfolio_id: int,
    item_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
        
    item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.id == item_id,
        models.PortfolioItem.portfolio_id == portfolio_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
        
    db.delete(item)
    db.commit()
    return

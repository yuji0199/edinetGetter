from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import json
from datetime import datetime

import models
import schemas
import database
from routers.auth import get_current_user

router = APIRouter(
    prefix="/analysis",
    tags=["Analysis Methods"]
)

@router.get("/", response_model=List[schemas.AnalysisMethodResponse])
def get_analysis_methods(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    methods = db.query(models.AnalysisMethod).filter(models.AnalysisMethod.user_id == current_user.id).all()
    return methods

@router.post("/", response_model=schemas.AnalysisMethodResponse, status_code=status.HTTP_201_CREATED)
def create_analysis_method(
    method: schemas.AnalysisMethodCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        # Validate JSON format
        json.loads(method.conditions_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for conditions")
        
    db_method = models.AnalysisMethod(
        user_id=current_user.id,
        name=method.name,
        description=method.description,
        conditions_json=method.conditions_json
    )
    db.add(db_method)
    db.commit()
    db.refresh(db_method)
    return db_method

@router.put("/{method_id}", response_model=schemas.AnalysisMethodResponse)
def update_analysis_method(
    method_id: int,
    method_update: schemas.AnalysisMethodCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_method = db.query(models.AnalysisMethod).filter(
        models.AnalysisMethod.id == method_id,
        models.AnalysisMethod.user_id == current_user.id
    ).first()
    
    if not db_method:
        raise HTTPException(status_code=404, detail="Analysis method not found")
        
    try:
        json.loads(method_update.conditions_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for conditions")
        
    db_method.name = method_update.name
    db_method.description = method_update.description
    db_method.conditions_json = method_update.conditions_json
    
    db.commit()
    db.refresh(db_method)
    return db_method

@router.delete("/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis_method(
    method_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_method = db.query(models.AnalysisMethod).filter(
        models.AnalysisMethod.id == method_id,
        models.AnalysisMethod.user_id == current_user.id
    ).first()
    
    if not db_method:
        raise HTTPException(status_code=404, detail="Analysis method not found")
        
    db.delete(db_method)
    db.commit()
    return

def evaluate_condition(metric_value: float, operator: str, target_value: float) -> bool:
    if operator == ">=":
        return metric_value >= target_value
    elif operator == "<=":
        return metric_value <= target_value
    elif operator == ">":
        return metric_value > target_value
    elif operator == "<":
        return metric_value < target_value
    elif operator == "==":
        return metric_value == target_value
    return False

@router.post("/{method_id}/screen")
def run_screening(
    method_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    method = db.query(models.AnalysisMethod).filter(
        models.AnalysisMethod.id == method_id,
        models.AnalysisMethod.user_id == current_user.id
    ).first()
    
    if not method:
        raise HTTPException(status_code=404, detail="Analysis method not found")
        
    try:
        conditions = json.loads(method.conditions_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid conditions format")

    # Get latest documents for all stocks
    # Need to group by stock_id and get the latest
    subquery = db.query(
        models.FinancialDocument.stock_id,
        func.max(models.FinancialDocument.id).label('latest_id')
    ).group_by(models.FinancialDocument.stock_id).subquery()
    
    latest_docs = db.query(models.FinancialDocument).join(
        subquery, models.FinancialDocument.id == subquery.c.latest_id
    ).all()
    
    matched_results = []
    
    for doc in latest_docs:
        if not doc.metrics_json:
            continue
            
        try:
            metrics = json.loads(doc.metrics_json)
        except:
            continue
            
        # Evaluate all conditions (AND logic)
        is_match = True
        extracted_info = {}
        
        # Cache growth result for this stock if multiple growth conditions exist
        growth_result = None

        for cond in conditions:
            metric_key = cond.get("metric", "")
            operator = cond.get("operator")
            target_value = cond.get("value")
            
            if not all([metric_key, operator, target_value is not None]):
                is_match = False
                break
            
            # 1. Determine the metric value
            metric_val = None
            
            # Check if it's a growth or CAGR metric
            if metric_key.endswith("_growth") or metric_key.startswith("cagr_") or metric_key == "fcf":
                if growth_result is None:
                    from .growth import calculate_growth_for_stock
                    growth_result = calculate_growth_for_stock(doc.stock_id, db)
                
                if metric_key.startswith("cagr_"):
                    metric_val = getattr(growth_result, metric_key, 0)
                elif metric_key.endswith("_growth") or metric_key == "fcf":
                    if growth_result.latest:
                        metric_val = getattr(growth_result.latest, metric_key, 0)
                    else:
                        metric_val = 0
            else:
                # Standard metric from latest doc
                metric_val = metrics.get(metric_key)
                
            if metric_val is None:
                is_match = False
                break
                
            # 2. Evaluate condition
            try:
                metric_val_float = float(metric_val)
                target_value_float = float(target_value)
                if not evaluate_condition(metric_val_float, operator, target_value_float):
                    is_match = False
                    break
                extracted_info[metric_key] = metric_val_float
            except (ValueError, TypeError):
                is_match = False
                break
                
        if is_match:
            stock = db.query(models.Stock).filter(models.Stock.id == doc.stock_id).first()
            if stock:
                matched_results.append({
                    "stock": schemas.StockResponse.model_validate(stock),
                    "document_id": doc.doc_id,
                    "submit_datetime": doc.submit_datetime,
                    "metrics": extracted_info
                })
                
    return matched_results

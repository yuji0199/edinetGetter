import os
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime, timezone
from typing import List

import models, schemas, database
from routers.auth import get_current_user
from services.edinet import EdinetClient
from services.xbrl import XBRLParser

router = APIRouter(prefix="/edinet", tags=["edinet"])

edinet_client = EdinetClient()
xbrl_parser = XBRLParser()

@router.post("/sync")
def sync_edinet_data(
    background_tasks: BackgroundTasks,
    target_date: date, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Trigger sync for a specific date in the background.
    """
    background_tasks.add_task(run_full_sync, target_date)
    return {"message": f"Sync started for {target_date} in background"}

def run_full_sync(target_date: date):
    """
    Internal function to run synchronization without limits, 
    intended for background execution.
    """
    db = database.SessionLocal()
    try:
        # Fetch financial documents (Yuho, Quarterly, Semi-annual, Extraordinary)
        docs = edinet_client.get_document_list(target_date)
        
        processed = 0
        errors = 0
        
        for doc in docs:
            if not doc.secCode:
                continue
                
            securities_code = doc.secCode[:4]
            stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
            if not stock:
                stock = models.Stock(
                    securities_code=securities_code, 
                    company_name=doc.filerName or "Unknown", 
                    industry="未分類"
                )
                db.add(stock)
                db.commit()
                db.refresh(stock)
                
            existing_doc = db.query(models.FinancialDocument).filter(models.FinancialDocument.doc_id == doc.docID).first()
            if existing_doc:
                continue
                
            try:
                zip_path = edinet_client.download_document_zip(doc.docID)
                metrics = xbrl_parser.parse_zip(zip_path)
                
                submit_dt = None
                if doc.submitDateTime:
                    try:
                        submit_dt = datetime.strptime(doc.submitDateTime, "%Y-%m-%d %H:%M")
                        submit_dt = submit_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                # Parse period dates from metrics
                period_start = None
                period_end = None
                if metrics.get("period_start"):
                    try:
                        period_start = datetime.strptime(metrics["period_start"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass
                if metrics.get("period_end"):
                    try:
                        period_end = datetime.strptime(metrics["period_end"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                new_doc = models.FinancialDocument(
                    doc_id=doc.docID,
                    stock_id=stock.id,
                    period_start=period_start,
                    period_end=period_end,
                    submit_datetime=submit_dt,
                    net_sales=metrics.get("net_sales"),
                    operating_income=metrics.get("operating_income"),
                    ordinary_income=metrics.get("ordinary_income"),
                    net_income=metrics.get("net_income"),
                    total_assets=metrics.get("total_assets"),
                    net_assets=metrics.get("net_assets"),
                    equity_ratio=metrics.get("equity_ratio"),
                    roe=metrics.get("roe"),
                    roa=metrics.get("roa"),
                    operating_cf=metrics.get("operating_cf"),
                    investing_cf=metrics.get("investing_cf"),
                    financing_cf=metrics.get("financing_cf"),
                    metrics_json=json.dumps(metrics)
                )
                db.add(new_doc)
                db.commit()
                processed += 1
                
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                    
            except Exception as e:
                print(f"Error processing {doc.docID} in background: {e}")
                errors += 1
                db.rollback()
                
        print(f"Background sync completed for {target_date}: {processed} processed, {errors} errors")
    finally:
        db.close()

@router.get("/documents", response_model=List[schemas.FinancialDocumentResponse])
def get_documents(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.FinancialDocument).options(joinedload(models.FinancialDocument.stock)).order_by(models.FinancialDocument.id.desc()).limit(100).all()

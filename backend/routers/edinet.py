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

@router.post("/sync", response_model=schemas.SyncResponse)
def sync_edinet_data(
    target_date: date, 
    limit: int = 5, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch documents for a specific date, download ZIPs, parse XBRL, and store in DB.
    Limited to `limit` documents by default to prevent long blocking operations in dev.
    """
    try:
        docs = edinet_client.get_document_list(target_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch document list: {str(e)}")
        
    processed = 0
    errors = 0
    
    for doc in docs:
        if processed >= limit:
            break
            
        if not doc.secCode:
            continue
            
        # Register stock if not exists
        securities_code = doc.secCode[:4] # Usually 5 chars, last is 0 for ordinary
        stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
        if not stock:
            # Fallbacks for missing data
            company_name = doc.filerName or "Unknown"
            
            # Use JPX mapping for industry, fallback to default
            industry = "未分類"
            mapping_path = os.path.join(os.path.dirname(__file__), "..", "industry_mapping.json")
            if os.path.exists(mapping_path):
                try:
                    with open(mapping_path, "r", encoding="utf-8") as f:
                        mapping = json.load(f)
                        industry = mapping.get(securities_code, "未分類")
                except Exception:
                    pass
                    
            stock = models.Stock(securities_code=securities_code, company_name=company_name, industry=industry)
            db.add(stock)
            db.commit()
            db.refresh(stock)
            
        # Check if doc already exists
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

            # Save the document
            new_doc = models.FinancialDocument(
                doc_id=doc.docID,
                stock_id=stock.id,
                submit_datetime=submit_dt,
                metrics_json=json.dumps(metrics)
            )
            db.add(new_doc)
            db.commit()
            processed += 1
            
            # Cleanup zip
            if os.path.exists(zip_path):
                os.remove(zip_path)
                
        except Exception as e:
            print(f"Error processing {doc.docID}: {e}")
            errors += 1
            
    return {"message": f"Sync completed for {target_date}", "processed": processed, "errors": errors}

@router.get("/documents", response_model=List[schemas.FinancialDocumentResponse])
def get_documents(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.FinancialDocument).options(joinedload(models.FinancialDocument.stock)).order_by(models.FinancialDocument.id.desc()).limit(100).all()

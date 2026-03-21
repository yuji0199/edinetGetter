import os
import sys
import json
import logging
from datetime import datetime, date, timezone
import argparse
from dotenv import load_dotenv

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
from database import SessionLocal, engine
from services.edinet import edinet_client
from services.xbrl import xbrl_parser

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("sync_job.log")
    ]
)
logger = logging.getLogger("sync_job")

def is_scheduled_time():
    """Checks if the current time is within the allowed window: Weekdays 9:00 - 17:15"""
    now = datetime.now()
    
    # Weekday check (0=Monday, 6=Sunday)
    if now.weekday() >= 5:
        logger.info("Today is a weekend. Skipping sync.")
        return False
        
    start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = now.replace(hour=17, minute=15, second=0, microsecond=0)
    
    if not (start_time <= now <= end_time):
        logger.info(f"Current time {now.strftime('%H:%M')} is outside the window (9:00-17:15). Skipping sync.")
        return False
        
    return True

def run_sync(target_date=None, force=False):
    if not force and not is_scheduled_time():
        return

    load_dotenv()
    
    if target_date:
        sync_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    else:
        sync_date = date.today()

    logger.info(f"Starting sync job for {sync_date}...")
    
    db = SessionLocal()
    try:
        # Fetch all documents for the date
        docs = edinet_client.get_document_list(sync_date, only_financial=False)
        logger.info(f"Found {len(docs)} documents on EDINET.")
        
        processed = 0
        skipped = 0
        errors = 0
        
        for doc in docs:
            # We process docs with secCode (listed companies)
            if not doc.secCode:
                skipped += 1
                continue
                
            securities_code = doc.secCode[:4]
            
            # Register or get stock
            stock = db.query(models.Stock).filter(models.Stock.securities_code == securities_code).first()
            if not stock:
                # Basic stock info from doc
                stock = models.Stock(
                    securities_code=securities_code,
                    company_name=doc.filerName or "Unknown",
                    industry="未分類"
                )
                db.add(stock)
                db.commit()
                db.refresh(stock)
            
            # Check if doc exists
            existing_doc = db.query(models.FinancialDocument).filter(models.FinancialDocument.doc_id == doc.docID).first()
            if existing_doc:
                skipped += 1
                continue
                
            try:
                # Download and parse
                zip_path = edinet_client.download_document_zip(doc.docID)
                metrics = xbrl_parser.parse_zip(zip_path)
                
                # Parse submit datetime
                submit_dt = None
                if doc.submitDateTime:
                    try:
                        submit_dt = datetime.strptime(doc.submitDateTime, "%Y-%m-%d %H:%M")
                        submit_dt = submit_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                # Save doc
                new_doc = models.FinancialDocument(
                    doc_id=doc.docID,
                    stock_id=stock.id,
                    submit_datetime=submit_dt,
                    metrics_json=json.dumps(metrics)
                )
                db.add(new_doc)
                db.commit()
                processed += 1
                
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                
                if processed % 10 == 0:
                    logger.info(f"Processed {processed} documents...")
                    
            except Exception as e:
                logger.error(f"Error processing {doc.docID}: {e}")
                errors += 1
                db.rollback()
                
        logger.info(f"Sync complete. Processed: {processed}, Skipped: {skipped}, Errors: {errors}")
        
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EDINET Sync Job")
    parser.add_argument("--date", help="Target date (YYYY-MM-DD), default is today")
    parser.add_argument("--force", action="store_true", help="Force run regardless of time window")
    
    args = parser.parse_args()
    
    # Ensure tables are created
    models.Base.metadata.create_all(bind=engine)
    
    run_sync(target_date=args.date, force=args.force)

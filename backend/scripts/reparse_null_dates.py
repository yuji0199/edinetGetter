import os
import sys
import time
import json
import logging
import argparse
from datetime import datetime, timezone

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
from database import SessionLocal
from services.edinet import edinet_client
from services.xbrl import xbrl_parser

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("reparse_null_dates.log")
    ]
)
logger = logging.getLogger("reparse")

def reparse_null_dates(throttle=1.0, limit=None):
    db = SessionLocal()
    try:
        query = db.query(models.FinancialDocument).filter(models.FinancialDocument.period_end == None)
        if limit is not None:
            query = query.limit(limit)
            
        docs = query.all()
        total_docs = len(docs)
        logger.info(f"Found {total_docs} documents with missing period_end.")
        
        processed = 0
        errors = 0
        skipped = 0
        
        for i, doc in enumerate(docs):
            doc_id = doc.doc_id
            logger.info(f"--- [ {i+1} / {total_docs} ] Reparsing {doc_id} ---")
            
            try:
                zip_path = edinet_client.download_document_zip(doc_id)
                
                # Check if the downloaded file is actually a zip (for older / removed docs)
                with open(zip_path, 'rb') as f:
                    header = f.read(4)
                    if header != b'PK\x03\x04':
                        logger.warning(f"{doc_id} is not a valid zip file, it may be unavailable on EDINET. Skipping.")
                        os.remove(zip_path)
                        skipped += 1
                        continue

                metrics = xbrl_parser.parse_zip(zip_path)
                
                # Update DB with parsed dates
                if metrics.get("period_start"):
                    try:
                        doc.period_start = datetime.strptime(metrics["period_start"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass
                
                if metrics.get("period_end"):
                    try:
                        doc.period_end = datetime.strptime(metrics["period_end"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                doc.metrics_json = json.dumps(metrics)
                db.commit()
                processed += 1
                
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                    
            except Exception as e:
                logger.error(f"Error processing {doc_id}: {e}")
                errors += 1
                db.rollback()
                
            if throttle > 0:
                time.sleep(throttle)
                
        logger.info(f"Reparse complete. Processed: {processed}, Skipped: {skipped}, Errors: {errors}")

    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reparse Documents with Null Period End")
    parser.add_argument("--limit", type=int, default=None, help="Number of documents to reparse (default: all)")
    parser.add_argument("--throttle", type=float, default=1.0, help="Seconds to wait between calls")
    
    args = parser.parse_args()
    
    reparse_null_dates(throttle=args.throttle, limit=args.limit)

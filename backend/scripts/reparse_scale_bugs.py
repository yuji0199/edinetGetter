import os
import sys
import time
import json
import logging
import argparse
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

import models
from database import SessionLocal
from services.edinet import edinet_client
from services.xbrl import xbrl_parser

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("reparse_scale_bugs.log")
    ]
)
logger = logging.getLogger("reparse_scale")

def reparse_suspicious_docs(throttle=1.0):
    db = SessionLocal()
    try:
        # Find all documents that look like they missed `scale` parsing 
        # (e.g. total sales under 100 Million implies missing 6 zeros in most cases)
        all_docs = db.query(models.FinancialDocument).all()
        suspicious_docs = []
        for doc in all_docs:
            if not doc.metrics_json: continue
            
            metrics = json.loads(doc.metrics_json)
            sales = metrics.get('net_sales')
            # 1億未満ならスケール漏れの可能性が大
            if sales is not None and sales < 100_000_000:
                suspicious_docs.append(doc)
                
        total_docs = len(suspicious_docs)
        logger.info(f"Found {total_docs} documents with potentially missing scale.")
        
        processed = 0
        errors = 0
        skipped = 0
        
        for i, doc in enumerate(suspicious_docs):
            doc_id = doc.doc_id
            logger.info(f"--- [ {i+1} / {total_docs} ] Reparsing {doc_id} ---")
            
            try:
                zip_path = edinet_client.download_document_zip(doc_id)
                
                with open(zip_path, 'rb') as f:
                    header = f.read(4)
                    if header != b'PK\x03\x04':
                        logger.warning(f"Invalid zip for {doc_id}. Skipping.")
                        os.remove(zip_path)
                        skipped += 1
                        continue

                metrics = xbrl_parser.parse_zip(zip_path)
                
                # Update DB with freshly parsed metrics (now including scale applied)
                # Keep original accounting_standard if exists since it was manually processed or handled
                old_metrics = json.loads(doc.metrics_json)
                if 'accounting_standard' in old_metrics:
                    metrics['accounting_standard'] = old_metrics['accounting_standard']
                elif doc.accounting_standard:
                    metrics['accounting_standard'] = doc.accounting_standard
                    
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
    parser = argparse.ArgumentParser(description="Reparse scale extraction bugs")
    parser.add_argument("--throttle", type=float, default=1.0, help="Seconds to wait between calls")
    args = parser.parse_args()
    
    reparse_suspicious_docs(throttle=args.throttle)

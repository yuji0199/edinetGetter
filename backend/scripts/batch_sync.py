import os
import sys
import time
import logging
import argparse
from datetime import datetime, date, timedelta

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.sync_job import run_sync

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("batch_sync.log")
    ]
)
logger = logging.getLogger("batch_sync")

def batch_sync(years=2, days=None, throttle=1.0, force=True):
    """
    Sync EDINET data for a range of dates.
    """
    end_date = date.today()
    if days:
        start_date = end_date - timedelta(days=days)
    else:
        start_date = end_date - timedelta(days=years * 365)

    delta = end_date - start_date
    logger.info(f"Starting batch sync from {start_date} to {end_date} ({delta.days} days)...")

    for i in range(delta.days + 1):
        target_date = start_date + timedelta(days=i)
        target_date_str = target_date.strftime("%Y-%m-%d")
        
        # Skip weekends unless forced (EdinetClient might not have data anyway)
        if target_date.weekday() >= 5:
            logger.info(f"Skipping weekend: {target_date_str}")
            continue

        try:
            logger.info(f"--- [ {i+1} / {delta.days + 1} ] Syncing {target_date_str} ---")
            # Reuse sync_job.py's run_sync with force=True to bypass time window checks
            run_sync(target_date=target_date_str, force=force)
            
            # Rate limit throttling
            if throttle > 0:
                logger.info(f"Throttling for {throttle}s...")
                time.sleep(throttle)
                
        except Exception as e:
            logger.error(f"Failed to sync {target_date_str}: {e}")
            # Continue to next date even if one fails
            time.sleep(throttle * 2) 

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EDINET Batch Sync Job")
    parser.add_argument("--years", type=int, default=2, help="Number of years to go back")
    parser.add_argument("--days", type=int, help="Number of days to go back (overrides --years)")
    parser.add_argument("--throttle", type=float, default=1.0, help="Seconds to wait between calls")
    parser.add_argument("--no-force", action="store_false", dest="force", help="Don't force sync (respect time windows)")
    
    args = parser.parse_args()
    
    batch_sync(years=args.years, days=args.days, throttle=args.throttle, force=args.force)

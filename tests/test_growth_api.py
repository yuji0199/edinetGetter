import sys
import os
import json

# Add project root to path
sys.path.append(os.getcwd())

# Set database path for testing
db_path = os.path.join(os.getcwd(), "backend", "edinet.db")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

from backend.database import SessionLocal
from backend.routers.growth import get_growth_analysis

def test_growth_7115():
    db = SessionLocal()
    try:
        from backend import models
        from datetime import datetime
        
        # 1. Manually update period_end for 7115 docs to simulate history
        # (Since current DB has NULLs)
        docs = db.query(models.FinancialDocument).filter(
            models.FinancialDocument.stock_id == (
                db.query(models.Stock.id).filter(models.Stock.securities_code == "7115").scalar()
            )
        ).order_by(models.FinancialDocument.submit_datetime.asc()).all()
        
        print(f"Found {len(docs)} documents for 7115. Updating period_end for testing...")
        for i, doc in enumerate(docs):
            # Assign years 2019, 2020, 2021...
            year = 2019 + i
            doc.period_end = datetime(year, 12, 31)
            # Add some dummy metrics for growth testing if missing
            metrics = json.loads(doc.metrics_json) if doc.metrics_json else {}
            metrics["net_sales"] = 1000 + (i * 200) # Increasing sales
            metrics["operating_income"] = 100 + (i * 20) # Increasing profit
            doc.metrics_json = json.dumps(metrics)
            
        db.commit()

        print("Testing growth analysis for 7115 (Alpha Purchase)...")
        result = get_growth_analysis(securities_code="7115", years=5, db=db)
        
        print(f"CAGR Sales: {result.cagr_sales}%")
        print(f"CAGR Profit: {result.cagr_profit}%")
        print("\nYearly Series (Latest First):")
        for item in result.series:
            print(f"Year: {item.year}")
            print(f"  Sales: {item.sales} (Growth: {item.sales_growth}%)")
            print(f"  Operating Income: {item.operating_income} (Growth: {item.profit_growth}%)")
            print("-" * 20)
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_growth_7115()

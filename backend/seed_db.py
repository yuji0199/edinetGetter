import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from utils.auth import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # 1. Create test user
        test_user = db.query(models.User).filter(
            (models.User.username == "docuser") | (models.User.email == "doc@example.com")
        ).first()
        if not test_user:
            test_user = models.User(
                username="docuser",
                email="doc@example.com",
                hashed_password=get_password_hash("password123")
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            print(f"Created user: {test_user.username}")
        else:
            print(f"User {test_user.username} (or email) already exists")

        # 2. Create stocks
        stocks_data = [
            {"code": "7203", "name": "トヨタ自動車", "industry": "輸送用機器"},
            {"code": "9984", "name": "ソフトバンクグループ", "industry": "情報・通信業"},
            {"code": "6758", "name": "ソニーグループ", "industry": "電気機器"}
        ]
        
        db_stocks = []
        for s in stocks_data:
            db_stock = db.query(models.Stock).filter(models.Stock.securities_code == s["code"]).first()
            if not db_stock:
                db_stock = models.Stock(
                    securities_code=s["code"],
                    company_name=s["name"],
                    industry=s["industry"]
                )
                db.add(db_stock)
                print(f"Created stock: {s['name']} ({s['code']})")
            db_stocks.append(db_stock)
        db.commit()

        # 3. Create financial documents with metrics
        # We'll add some mock history for charts
        for db_stock in db_stocks:
            for i in range(3): # 3 years of data
                year = 2022 + i
                doc_id = f"S100P{db_stock.securities_code}{year}"
                db_doc = db.query(models.FinancialDocument).filter(models.FinancialDocument.doc_id == doc_id).first()
                if not db_doc:
                    metrics = {
                        "net_sales": 20000000000000 + (i * 2000000000000),
                        "operating_income": 2000000000000 + (i * 300000000000),
                        "net_income": 1500000000000 + (i * 200000000000),
                        "total_assets": 50000000000000 + (i * 5000000000000),
                        "net_assets": 20000000000000 + (i * 2000000000000),
                        "eps": 200.0 + (i * 20.0),
                        "bps": 2000.0 + (i * 150.0),
                        "roe": 7.5 + (i * 0.5),
                        "roa": 3.0 + (i * 0.2),
                        "equity_ratio": 40.0,
                        "operating_margin": 10.0
                    }
                    db_doc = models.FinancialDocument(
                        doc_id=doc_id,
                        stock_id=db_stock.id,
                        period_start=datetime(year, 4, 1),
                        period_end=datetime(year+1, 3, 31),
                        submit_datetime=datetime(year+1, 6, 25),
                        metrics_json=json.dumps(metrics)
                    )
                    db.add(db_doc)
                    print(f"Created document for {db_stock.company_name} ({year})")
        db.commit()

        # 4. Create Analysis Method
        method_name = "高収益グロース株"
        db_method = db.query(models.AnalysisMethod).filter(models.AnalysisMethod.user_id == test_user.id, models.AnalysisMethod.name == method_name).first()
        if not db_method:
            conditions = [
                {"metric": "roe", "operator": ">=", "value": 10},
                {"metric": "operating_margin", "operator": ">=", "value": 8}
            ]
            db_method = models.AnalysisMethod(
                user_id=test_user.id,
                name=method_name,
                description="ROE 10%以上かつ営業利益率 8%以上の優良銘柄",
                conditions_json=json.dumps(conditions)
            )
            db.add(db_method)
            print(f"Created analysis method: {method_name}")
        db.commit()

        # 5. Create Portfolio
        portfolio_name = "優良バリュー銘柄"
        db_portfolio = db.query(models.Portfolio).filter(models.Portfolio.user_id == test_user.id, models.Portfolio.name == portfolio_name).first()
        if not db_portfolio:
            db_portfolio = models.Portfolio(
                user_id=test_user.id,
                name=portfolio_name,
                description="配当利回りが高く、財務が健全な銘柄リスト"
            )
            db.add(db_portfolio)
            db.commit()
            db.refresh(db_portfolio)
            print(f"Created portfolio: {portfolio_name}")
            
            # Add items to portfolio
            for db_stock in db_stocks:
                item = models.PortfolioItem(
                    portfolio_id=db_portfolio.id,
                    stock_id=db_stock.id,
                    notes=f"{db_stock.company_name}のメモ",
                    target_price=3500.0 if db_stock.securities_code == "7203" else 10000.0
                )
                db.add(item)
            db.commit()
            print(f"Added stocks to portfolio: {portfolio_name}")

    finally:
        db.close()

if __name__ == "__main__":
    # Ensure tables are created
    models.Base.metadata.create_all(bind=engine)
    seed()

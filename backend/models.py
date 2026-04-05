from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    analysis_methods = relationship("AnalysisMethod", back_populates="user")
    portfolios = relationship("Portfolio", back_populates="user")


class Stock(Base):
    __tablename__ = "stocks"
    id = Column(Integer, primary_key=True, index=True)
    securities_code = Column(String(10), unique=True, index=True)
    company_name = Column(String(255))
    industry = Column(String(100))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class FinancialDocument(Base):
    __tablename__ = "financial_documents"
    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String(50), unique=True, index=True) # EDINET docID
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    submit_datetime = Column(DateTime(timezone=True)) # Document submission/issue date
    net_sales = Column(Float, nullable=True)
    operating_income = Column(Float, nullable=True)
    ordinary_income = Column(Float, nullable=True)
    net_income = Column(Float, nullable=True)
    total_assets = Column(Float, nullable=True)
    net_assets = Column(Float, nullable=True)
    equity_ratio = Column(Float, nullable=True)
    roe = Column(Float, nullable=True)
    roa = Column(Float, nullable=True)
    operating_cf = Column(Float, nullable=True)
    investing_cf = Column(Float, nullable=True)
    financing_cf = Column(Float, nullable=True)
    accounting_standard = Column(String(50), nullable=True)
    metrics_json = Column(Text) # Store parsed XBRL metrics
    
    stock = relationship("Stock")

class AnalysisMethod(Base):
    __tablename__ = "analysis_methods"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    conditions_json = Column(Text) # Store conditions as JSON string (e.g. [{"metric": "net_sales", "operator": ">=", "value": 10000000000}])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="analysis_methods")

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="portfolios")
    items = relationship("PortfolioItem", back_populates="portfolio", cascade="all, delete-orphan")

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    notes = Column(Text, nullable=True)
    target_price = Column(Float, nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    portfolio = relationship("Portfolio", back_populates="items")
    stock = relationship("Stock")

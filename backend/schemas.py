from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class StockBase(BaseModel):
    securities_code: str
    company_name: str
    industry: Optional[str]

class StockResponse(StockBase):
    id: int
    updated_at: Optional[datetime]
    class Config:
        from_attributes = True

class StockDetailResponse(StockResponse):
    current_price: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None

class FinancialDocumentBase(BaseModel):
    doc_id: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    submit_datetime: Optional[datetime] = None
    net_sales: Optional[float] = None
    operating_income: Optional[float] = None
    ordinary_income: Optional[float] = None
    net_income: Optional[float] = None
    total_assets: Optional[float] = None
    net_assets: Optional[float] = None
    equity_ratio: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    operating_cf: Optional[float] = None
    investing_cf: Optional[float] = None
    financing_cf: Optional[float] = None
    accounting_standard: Optional[str] = None
    metrics_json: Optional[str] = None

class FinancialDocumentResponse(FinancialDocumentBase):
    id: int
    stock_id: int
    stock: Optional[StockResponse] = None
    
    class Config:
        from_attributes = True

class SyncResponse(BaseModel):
    message: str
    processed: int
    errors: int

class AnalysisMethodBase(BaseModel):
    name: str
    description: Optional[str] = None
    conditions_json: str

class AnalysisMethodCreate(AnalysisMethodBase):
    pass

class AnalysisMethodResponse(AnalysisMethodBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PortfolioItemBase(BaseModel):
    stock_id: int
    notes: Optional[str] = None
    target_price: Optional[float] = None

class PortfolioItemCreate(PortfolioItemBase):
    pass

class PortfolioItemResponse(PortfolioItemBase):
    id: int
    portfolio_id: int
    added_at: datetime
    stock: Optional[StockResponse] = None
    
    class Config:
        from_attributes = True

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioResponse(PortfolioBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[PortfolioItemResponse] = []

    class Config:
        from_attributes = True

class GrowthSeriesItem(BaseModel):
    year: str
    sales: float
    operating_income: float
    ordinary_income: float
    net_income: float
    dividend: float
    operating_cf: float
    fcf: float
    sales_growth: float
    profit_growth: float
    ordinary_growth: float
    net_income_growth: float
    dividend_growth: float
    operating_cf_growth: float
    fcf_growth: float

    class Config:
        from_attributes = True

class GrowthAnalysisResponse(BaseModel):
    series: List[GrowthSeriesItem]
    cagr_sales: float
    cagr_profit: float
    latest: Optional[GrowthSeriesItem] = None

    class Config:
        from_attributes = True

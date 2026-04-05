import _axios from 'axios';

export const api = _axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interfaces
export interface Stock {
    id: number;
    securities_code: string;
    company_name: string;
    industry: string;
    current_price?: number;
    per?: number;
    pbr?: number;
}

export interface AnalysisMethod {
    id: number;
    name: string;
    description?: string;
    conditions_json: string;
    created_at: string;
    updated_at?: string;
}

export interface AnalysisMethodCreate {
    name: string;
    description?: string;
    conditions_json: string;
}

export interface ScreeningResult {
    stock: {
        id: number;
        securities_code: string;
        company_name: string;
        industry: string;
    };
    document_id: string;
    submit_datetime: string;
    metrics: Record<string, number>;
}

export interface GrowthSeriesItem {
    year: string;
    sales: number;
    operating_income: number;
    ordinary_income: number;
    net_income: number;
    dividend: number;
    operating_cf: number;
    fcf: number;
    sales_growth: number;
    profit_growth: number;
    ordinary_growth: number;
    net_income_growth: number;
    dividend_growth: number;
    operating_cf_growth: number;
    fcf_growth: number;
}

export interface GrowthAnalysisResponse {
    series: GrowthSeriesItem[];
    cagr_sales: number;
    cagr_profit: number;
}

// Analysis Methods APIs
export const getAnalysisMethods = () => api.get<AnalysisMethod[]>('/analysis/');
export const createAnalysisMethod = (data: AnalysisMethodCreate) => api.post<AnalysisMethod>('/analysis/', data);
export const updateAnalysisMethod = (id: number, data: AnalysisMethodCreate) => api.put<AnalysisMethod>(`/analysis/${id}`, data);
export const deleteAnalysisMethod = (id: number) => api.delete(`/analysis/${id}`);
export const runScreening = (id: number) => api.post<ScreeningResult[]>(`/analysis/${id}/screen`);

export interface StockDocument {
    id: number;
    stock_id: number;
    doc_id: string;
    period_start?: string;
    period_end?: string;
    submit_datetime: string;
    accounting_standard?: string;
    metrics_json?: string;
    metrics?: Record<string, number>;
}

// Stock APIs
export const getStock = (code: string) => api.get<Stock>(`/stocks/${code}`);
export const getStockDocuments = (code: string) => api.get<StockDocument[]>(`/stocks/${code}/documents`);
export const getStockGrowth = (code: string) => api.get<GrowthAnalysisResponse>(`/stocks/${code}/growth`);

// Portfolio APIs
export interface PortfolioItem {
    id: number;
    portfolio_id: number;
    stock_id: number;
    notes?: string;
    target_price?: number;
    added_at: string;
    stock?: {
        id: number;
        securities_code: string;
        company_name: string;
        industry: string;
    };
}

export interface Portfolio {
    id: number;
    user_id: number;
    name: string;
    description?: string;
    created_at: string;
    updated_at?: string;
    items: PortfolioItem[];
}

export interface PortfolioCreate {
    name: string;
    description?: string;
}

export interface PortfolioItemCreate {
    stock_id: number;
    notes?: string;
    target_price?: number;
}

export const getPortfolios = () => api.get<Portfolio[]>('/portfolios/');
export const createPortfolio = (data: PortfolioCreate) => api.post<Portfolio>('/portfolios/', data);
export const getPortfolio = (id: number) => api.get<Portfolio>(`/portfolios/${id}`);
export const updatePortfolio = (id: number, data: PortfolioCreate) => api.put<Portfolio>(`/portfolios/${id}`, data);
export const deletePortfolio = (id: number) => api.delete(`/portfolios/${id}`);
export const addPortfolioItem = (portfolioId: number, data: PortfolioItemCreate) => api.post<PortfolioItem>(`/portfolios/${portfolioId}/items`, data);
export const deletePortfolioItem = (portfolioId: number, itemId: number) => api.delete(`/portfolios/${portfolioId}/items/${itemId}`);

export default api;

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, TrendingUp, BarChart3, Clock, AlertCircle, FolderPlus, X, LineChart as LineChartIcon, Zap } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { getStockGrowth, addPortfolioItem, getPortfolios, getStock, getStockDocuments, getStockForecast, saveStockForecast } from '../api';
import type { Portfolio, GrowthAnalysisResponse, Stock, StockDocument, UserStockForecast } from '../api';

/**
 * 財務指標の表示名マッピング
 * 画面上のラベルを一元管理するために定義
 */
const METRIC_DISPLAY_LABELS: Record<string, string> = {
    net_sales: "売上高",
    operating_income: "営業利益",
    ordinary_income: "経常利益",
    net_income: "純利益",
    total_assets: "総資産",
    net_assets: "純資産",
    operating_cf: "営業キャッシュフロー",
    investing_cf: "投資キャッシュフロー",
    financing_cf: "財務キャッシュフロー",
    eps: "1株当たり純利益 (EPS)",
    bps: "1株当たり純資産 (BPS)",
    roe: "自己資本利益率 (ROE)",
    roa: "総資産利益率 (ROA)",
    equity_ratio: "自己資本比率",
    operating_margin: "営業利益率",
    operating_cf_growth: "営業CF成長率",
    fcf_growth: "自己株式・フリーCF成長率",
    sales_growth: "売上高成長率",
    profit_growth: "営利成長率",
    ordinary_growth: "経利成長率",
    net_income_growth: "純利成長率",
    dividend_growth: "配当成長率",
    cagr_sales: "売上高CAGR",
    cagr_profit: "営業益CAGR",
    fcf: "フリーキャッシュフロー (FCF)"
};

/**
 * グラフのツールチップ表示用フォーマッタ。
 * Recharts の value 型 (number | string | Array) と undefined を安全に処理する。
 */
const percentageFormatter = (value: number | string | readonly (number | string)[] | undefined): string => {
    if (value === undefined || value === null) return '0%';
    const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
    return `${numericValue}%`;
};

/**
 * 日本語の大きな金額（スケール）を考慮したフォーマッタ。
 * 例: 29兆円, 450億円, 15百万円
 */
const formatJapaneseCurrency = (value: number | string | readonly (number | string)[] | undefined): string => {
    if (value === undefined || value === null) return '¥0';
    const num = Array.isArray(value) ? Number(value[0]) : Number(value);
    
    // EPSやBPSのような比較的小さい指標（1株あたり情報など）の場合
    if (Math.abs(num) < 10000 && num % 1 !== 0) {
        return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(num)}`;
    }
    
    if (Math.abs(num) >= 1_0000_0000_0000) {
        return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(num / 1_0000_0000_0000)}兆`;
    } else if (Math.abs(num) >= 1_0000_0000) {
        return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(num / 1_0000_0000)}億`;
    } else if (Math.abs(num) >= 100_0000) {
        return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(num / 100_0000)}百万`;
    }
    
    return `¥${new Intl.NumberFormat('ja-JP').format(num)}`;
};

/**
 * ツールチップ用フォーマッタ
 */
const currencyFormatter = (value: number | string | readonly (number | string)[] | undefined): string => {
    return formatJapaneseCurrency(value);
};

/**
 * 銘柄詳細画面コンポーネント
 * 銘柄の基本情報、財務推移グラフ、成長性分析データを表示する
 */
const StockDetail = () => {
    const { code } = useParams<{ code: string }>();
    const [stock, setStock] = useState<Stock | null>(null);
    const [documents, setDocuments] = useState<StockDocument[]>([]);
    const [growth, setGrowth] = useState<GrowthAnalysisResponse | null>(null);
    const [forecast, setForecast] = useState<UserStockForecast | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // ポートフォリオ追加用モーダルの状態管理
    const [showPortfolioModal, setShowPortfolioModal] = useState<boolean>(false);
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | ''>('');
    const [portfolioNotes, setPortfolioNotes] = useState<string>('');
    const [portfolioTargetPrice, setPortfolioTargetPrice] = useState<number | ''>('');
    const [isSubmittingPortfolio, setIsSubmittingPortfolio] = useState<boolean>(false);
    const [portfolioError, setPortfolioError] = useState<string | null>(null);
    const [portfolioSuccess, setPortfolioSuccess] = useState<boolean>(false);

    // 会社業績予想追加用モーダルの状態管理
    const [showForecastModal, setShowForecastModal] = useState<boolean>(false);
    const [forecastFormData, setForecastFormData] = useState<UserStockForecast>({});
    const [isSubmittingForecast, setIsSubmittingForecast] = useState<boolean>(false);
    const [forecastError, setForecastError] = useState<string | null>(null);
    const [forecastSuccess, setForecastSuccess] = useState<boolean>(false);

    useEffect(() => {
        /**
         * 銘柄の詳細情報、財務書類、ポートフォリオ一覧、成長性データを一括で取得する
         */
        const fetchAllStockData = async () => {
            if (!code) return;
            try {
                setLoading(true);
                // 並列実行により初期ロード時間を短縮する意図
                const [stockRes, docsRes, portRes, growthRes, forecastRes] = await Promise.allSettled([
                    getStock(code),
                    getStockDocuments(code),
                    getPortfolios(),
                    getStockGrowth(code),
                    getStockForecast(code)
                ]);
                
                if (stockRes.status === "fulfilled") setStock(stockRes.value.data);
                if (portRes.status === "fulfilled") setPortfolios(portRes.value.data);
                if (growthRes.status === "fulfilled") setGrowth(growthRes.value.data);
                
                if (forecastRes.status === "fulfilled" && forecastRes.value.data) {
                    setForecast(forecastRes.value.data);
                    setForecastFormData(forecastRes.value.data);
                }

                // metrics_jsonをパースして型定義済みのオブジェクトとして扱う
                if (docsRes.status === "fulfilled") {
                const rawDocuments = docsRes.value.data.map((document: StockDocument) => ({
                    ...document,
                    metrics: document.metrics_json ? JSON.parse(document.metrics_json) : {}
                }));

                // 決算年度（FY）ごとに最新の提出書類だけを残すように重複排除
                const groupedByFY = rawDocuments.reduce((acc: Record<string, typeof rawDocuments[0]>, doc: typeof rawDocuments[0]) => {
                    const dateStr = doc.period_end || '';
                    if (!dateStr) {
                        acc[doc.doc_id] = doc;
                        return acc;
                    }
                    const [yearStr, monthStr] = dateStr.split('-');
                    const year = parseInt(yearStr, 10);
                    const month = parseInt(monthStr, 10);
                    const fy = month <= 3 ? year - 1 : year;
                    
                    if (!acc[fy] || new Date(doc.submit_datetime) > new Date(acc[fy].submit_datetime)) {
                        acc[fy] = doc;
                    }
                    return acc;
                }, {});
                
                const formattedDocuments = Object.values(groupedByFY).sort((a: any, b: any) => 
                    new Date(a.period_end || '').getTime() - new Date(b.period_end || '').getTime()
                );

                setDocuments(formattedDocuments as StockDocument[]);
                }
                setError(null);
            } catch (err: unknown) {
                console.error("銘柄データの取得に失敗しました", err);
                setError("銘柄詳細の読み込みに失敗しました。証券コードが正しいか確認してください。");
            } finally {
                setLoading(false);
            }
        };

        fetchAllStockData();
    }, [code]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !stock) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-6">
                    <ArrowLeft className="mr-1 h-4 w-4" /> ダッシュボードに戻る
                </Link>
                <div className="bg-red-50 p-4 rounded-md flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                    <div>
                        <h3 className="text-sm font-medium text-red-800">データの読み込みエラー</h3>
                        <p className="mt-1 text-sm text-red-700">{error || "不明なエラーが発生しました。"}</p>
                    </div>
                </div>
            </div>
        );
    }

    /**
     * 財務推移棒グラフ用のデータ整形。
     * 古い順に表示するために、APIから取得したデータをそのままの順序で変換。
     */
    const barChartFormattedData = documents.map(document => {
        // period_end (例: "2023-03-31") から決算月を加味して年度(FY)を算出する
        const getFiscalYear = (dateStr: string) => {
            if (!dateStr) return '';
            const [yearStr, monthStr] = dateStr.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            return month <= 3 ? String(year - 1) : String(year);
        };
        const year = getFiscalYear(document.period_end || '');
        const label = year ? `${year}年度` : document.doc_id;

        
        return {
            name: label,
            sales: document.metrics?.net_sales || 0,
            operating_income: document.metrics?.operating_income || 0,
            ordinary_income: document.metrics?.ordinary_income || 0,
            net_income: document.metrics?.net_income || 0,
        };
    });

    if (forecast && (forecast.forecast_net_sales || forecast.forecast_net_income || forecast.forecast_operating_income)) {
        barChartFormattedData.push({
            name: forecast.target_year ? `${forecast.target_year} (予)` : "会社予想",
            sales: forecast.forecast_net_sales || 0,
            operating_income: forecast.forecast_operating_income || 0,
            ordinary_income: forecast.forecast_ordinary_income || 0,
            net_income: forecast.forecast_net_income || 0,
        });
    }

    // 最新のドキュメントから会計基準を取得
    const latestDocument = documents.length > 0 ? documents[documents.length - 1] : null;
    const accountingStandard = latestDocument?.accounting_standard || 'J-GAAP';
    const isIFRS = accountingStandard === 'IFRS';
    
    // IFRS向け動的ラベル変換関数
    const getMetricLabel = (key: string, isIFRS: boolean) => {
        const baseLabel = METRIC_DISPLAY_LABELS[key] || key.replace(/_/g, ' ');
        if (!isIFRS) return baseLabel;
        
        switch (key) {
            case 'net_sales': return '売上収益';
            case 'operating_income': return '営業利益/損失';
            case 'ordinary_income': return '経常利益 (税引前利益)';
            case 'net_income': return '親会社の所有者に帰属する当期利益';
            case 'net_assets': return '資本';
            default: return baseLabel;
        }
    };

    /**
     * ポートフォリオへの新規追加処理。
     * バリデーション後にAPIを呼び出し、成功時はフォームをリセットする。
     */
    const handlePortfolioAdditionSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedPortfolioId || !stock) return;

        setIsSubmittingPortfolio(true);
        setPortfolioError(null);
        setPortfolioSuccess(false);
        try {
            await addPortfolioItem(Number(selectedPortfolioId), {
                stock_id: stock.id,
                notes: portfolioNotes,
                target_price: portfolioTargetPrice || undefined
            });
            setPortfolioSuccess(true);
            setPortfolioNotes('');
            setPortfolioTargetPrice('');
            // 成功時は数秒後にモーダルを閉じるか、ユーザーに閉じさせる。ここでは数秒表示してから閉じる。
            setTimeout(() => {
                setShowPortfolioModal(false);
                setPortfolioSuccess(false);
            }, 2000);
        } catch (err: any) {
            setPortfolioError(err.response?.data?.detail || '追加に失敗しました。時間をおいて再度お試しください。');
        } finally {
            setIsSubmittingPortfolio(false);
        }
    };

    /**
     * 業績予想の保存処理
     */
    const handleForecastSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!code || !stock) return;

        setIsSubmittingForecast(true);
        setForecastError(null);
        setForecastSuccess(false);
        try {
            const res = await saveStockForecast(code, forecastFormData);
            setForecast(res.data);
            setForecastSuccess(true);
            setTimeout(() => {
                setShowForecastModal(false);
                setForecastSuccess(false);
            }, 2000);
        } catch (err: any) {
            setForecastError(err.response?.data?.detail || '保存に失敗しました。');
        } finally {
            setIsSubmittingForecast(false);
        }
    };

    const handleForecastChange = (field: keyof UserStockForecast, value: string) => {
        setForecastFormData(prev => ({
            ...prev,
            [field]: value === '' ? undefined : (field === 'target_year' ? value : Number(value))
        }));
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-6">
                <ArrowLeft className="mr-1 h-4 w-4" /> ダッシュボードに戻る
            </Link>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-blue-100 rounded-lg p-4 mr-6">
                            <Building2 className="h-8 w-8 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                                {stock.company_name}
                            </h1>
                            <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                                <span className="bg-gray-100 px-2.5 py-0.5 rounded-full font-medium text-gray-800">
                                    コード: {stock.securities_code}
                                </span>
                                {stock.industry && stock.industry !== "Unknown" && (
                                    <span className="flex items-center">
                                        <TrendingUp className="mr-1.5 h-4 w-4" />
                                        {stock.industry}
                                    </span>
                                )}
                                {documents.length > 0 && (
                                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                        isIFRS ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-800 border border-slate-200'
                                    }`}>
                                        {accountingStandard}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0 sm:pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    {stock.current_price && (
                        <div className="flex gap-4 sm:gap-6 text-left sm:text-right bg-gray-50 sm:bg-transparent p-4 sm:p-0 rounded-lg w-full sm:w-auto">
                            <div>
                                <div className="text-xs text-gray-500 font-medium tracking-wide">現在株価</div>
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 border-b-2 border-blue-200 pb-0.5 mt-0.5">
                                    ¥{stock.current_price.toLocaleString()}
                                </div>
                            </div>
                            {stock.per && (
                                <div>
                                    <div className="text-xs text-gray-500 font-medium tracking-wide">PER (実績)</div>
                                    <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                                        {stock.per.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-1">倍</span>
                                    </div>
                                </div>
                            )}
                            {stock.pbr && (
                                <div>
                                    <div className="text-xs text-gray-500 font-medium tracking-wide">PBR (実績)</div>
                                    <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                                        {stock.pbr.toFixed(2)}<span className="text-sm font-normal text-gray-500 ml-1">倍</span>
                                    </div>
                                </div>
                            )}
                            {forecast?.forecast_eps && (
                                <div>
                                    <div className="text-xs text-gray-500 font-medium tracking-wide text-indigo-600">PER (会社予想)</div>
                                    <div className="text-xl sm:text-2xl font-bold text-indigo-900 mt-0.5">
                                        {(stock.current_price / forecast.forecast_eps).toFixed(1)}<span className="text-sm font-normal text-indigo-500 ml-1">倍</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setShowForecastModal(true)}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border-2 border-indigo-100 rounded-lg shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            ✍️ 業績予想を入力する
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowPortfolioModal(true)}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            <FolderPlus className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                            ポートフォリオに追加
                        </button>
                    </div>
                </div>
            </div>

            {documents.length > 0 ? (
                <div className="space-y-8">
                    {/* 成長性分析セクション: CAGRおよびYoY推移を表示 */}
                    {growth && growth.series.length > 0 && (
                        <div className="space-y-8 mt-12">
                            <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-4 py-1">
                                成長性分析 (Growth Analysis)
                            </h2>
                            
                            {/* CAGRサマリーカード: 売上と利益の平均成長率を一目で確認できるようにする */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-blue-600 uppercase tracking-wider">売上高平均成長率 (CAGR)</p>
                                            <p className="text-3xl font-bold text-blue-900 mt-1">{growth.cagr_sales}%</p>
                                        </div>
                                        <div className="bg-blue-100 p-3 rounded-lg">
                                            <TrendingUp className="h-6 w-6 text-blue-600" />
                                        </div>
                                    </div>
                                    <p className="mt-4 text-xs text-gray-500 italic">過去 {growth.series.length} 年間の幾何平均成長率</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider">営業利益平均成長率 (CAGR)</p>
                                            <p className="text-3xl font-bold text-emerald-900 mt-1">{growth.cagr_profit}%</p>
                                        </div>
                                        <div className="bg-emerald-100 p-3 rounded-lg">
                                            <Zap className="h-6 w-6 text-emerald-600" />
                                        </div>
                                    </div>
                                    <p className="mt-4 text-xs text-gray-500 italic">過去 {growth.series.length} 年間の幾何平均成長率</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* 成長率推移チャート: YoYでの変動を可視化。FCFは点線で差別化 */}
                                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                                        <LineChartIcon className="mr-2 h-5 w-5 text-gray-500" />
                                        成長率の推移 (YoY %)
                                    </h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={growth.series.slice().reverse()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="year" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} unit="%" />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={percentageFormatter}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                                <Line type="monotone" dataKey="sales_growth" name="売上高成長率" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="profit_growth" name="営業益成長率" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="fcf_growth" name="FCF成長率" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* 直近指標リスト: 最新年度の数値を網羅 */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
                                            直近の成長指標
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4 space-y-3">
                                        {growth.series.length > 0 && [
                                            { key: 'sales_growth', val: growth.series[0].sales_growth },
                                            { key: 'profit_growth', val: growth.series[0].profit_growth },
                                            { key: 'ordinary_growth', val: growth.series[0].ordinary_growth },
                                            { key: 'net_income_growth', val: growth.series[0].net_income_growth },
                                            { key: 'dividend_growth', val: growth.series[0].dividend_growth },
                                            { key: 'fcf_growth', val: growth.series[0].fcf_growth },
                                        ].map(item => (
                                            <div key={item.key} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                <span className="text-sm text-gray-600">{getMetricLabel(item.key.replace('_growth', ''), isIFRS)}成長率</span>
                                                <span className={`text-sm font-bold ${Number(item.val) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {item.val >= 0 ? '+' : ''}{item.val}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* 財務状況棒グラフ: 売上と利益の実数値推移を把握するためのセクション */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <BarChart3 className="mr-2 h-5 w-5 text-gray-500" />
                                売上高と収益性
                                <span className="ml-2 text-xs font-normal text-gray-400 font-mono">(¥ JPY)</span>
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barChartFormattedData} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={(value) => formatJapaneseCurrency(value)} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip
                                            formatter={currencyFormatter}
                                            cursor={{ fill: '#F3F4F6' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                        <Bar dataKey="sales" name={isIFRS ? "売上収益" : "売上高"} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="operating_income" name={isIFRS ? "営業利益/損失" : "営業利益"} fill="#10B981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="net_income" name={isIFRS ? "親会社の所有者に帰属する当期利益" : "純利益"} fill="#6366F1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 直近の財務詳細: 最新の財務書類から抽出された全指標をタイル形式で表示 */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                    <Clock className="mr-2 h-5 w-5 text-gray-500" />
                                    {documents[documents.length - 1].submit_datetime
                                        ? `発行日: ${new Date(documents[documents.length - 1].submit_datetime).toLocaleDateString('ja-JP')}`
                                        : `取得した書類からの抽出データ (${documents[documents.length - 1].doc_id})`}
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto bg-gray-50 p-6">
                                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
                                    {Object.entries(documents[documents.length - 1].metrics || {})
                                        .filter(([key, value]) => !['period_start', 'period_end', 'accounting_standard'].includes(key) && value !== null)
                                        .map(([key, value]) => {
                                        const isPercentageMetric = ['roe', 'roa', 'equity_ratio', 'operating_margin'].includes(key);
                                        return (
                                            <div key={key} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 transition-colors">
                                                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate" title={key}>
                                                    {getMetricLabel(key, isIFRS)}
                                                </dt>
                                                <dd className="mt-1 flex items-baseline gap-1">
                                                    <span className={`text-lg font-semibold ${isPercentageMetric ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {isPercentageMetric
                                                            ? Number(value).toFixed(2)
                                                            : formatJapaneseCurrency(value)}
                                                    </span>
                                                    {isPercentageMetric && <span className="text-sm font-medium text-gray-500">%</span>}
                                                </dd>
                                            </div>
                                        )
                                    })}
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">財務データがありません</h3>
                    <p className="mt-2 text-sm text-gray-500">
                        この企業のXBRL書類はまだ同期されていません。ダッシュボードに戻ってEDINETからデータを同期してください。
                    </p>
                </div>
            )
            }

            {/* ポートフォリオ追加用モーダル */}
            {
                showPortfolioModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPortfolioModal(false)}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                                <form onSubmit={handlePortfolioAdditionSubmit}>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start">
                                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                                <FolderPlus className="h-6 w-6 text-blue-600" aria-hidden="true" />
                                            </div>
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                                        ポートフォリオに追加
                                                    </h3>
                                                    <button type="button" onClick={() => setShowPortfolioModal(false)} className="text-gray-400 hover:text-gray-500">
                                                        <X className="h-5 w-5" />
                                                    </button>
                                                </div>

                                                 <div className="mt-4 space-y-4">
                                                    {portfolioError && (
                                                        <div className="p-3 bg-red-50 border-l-4 border-red-500 flex justify-between items-start">
                                                            <div className="flex items-start">
                                                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2" />
                                                                <p className="text-xs text-red-700">{portfolioError}</p>
                                                            </div>
                                                            <button type="button" onClick={() => setPortfolioError(null)} className="text-red-400 hover:text-red-600 font-bold ml-2">×</button>
                                                        </div>
                                                    )}

                                                    {portfolioSuccess && (
                                                        <div className="p-3 bg-green-50 border-l-4 border-green-500 flex items-center">
                                                            <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                                                            <p className="text-xs text-green-700 font-bold">ポートフォリオに追加しました！</p>
                                                        </div>
                                                    )}
                                                    {/* 入力フォームの各項目 */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">対象ポートフォリオ</label>
                                                        <select
                                                            value={selectedPortfolioId}
                                                            onChange={(e) => setSelectedPortfolioId(Number(e.target.value))}
                                                            required
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                        >
                                                            <option value="">選択してください</option>
                                                            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">目標株価 (任意)</label>
                                                        <input
                                                            type="number"
                                                            value={portfolioTargetPrice}
                                                            onChange={(e) => setPortfolioTargetPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            placeholder="例: 5000"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">メモ (任意)</label>
                                                        <textarea
                                                            value={portfolioNotes}
                                                            onChange={(e) => setPortfolioNotes(e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            rows={3}
                                                            placeholder="注目した理由など"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                        <button
                                            type="submit"
                                            disabled={isSubmittingPortfolio}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                        >
                                            {isSubmittingPortfolio ? '処理中...' : '追加する'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowPortfolioModal(false)}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            キャンセル
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
            
            {/* 業績予想入力用モーダル */}
            {
                showForecastModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowForecastModal(false)}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-indigo-100">
                                <form onSubmit={handleForecastSubmit}>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start">
                                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                                                <TrendingUp className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                                            </div>
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">
                                                        会社業績予想の入力
                                                    </h3>
                                                    <button type="button" onClick={() => setShowForecastModal(false)} className="text-gray-400 hover:text-gray-500">
                                                        <X className="h-5 w-5" />
                                                    </button>
                                                </div>

                                                 <div className="mt-4 space-y-4">
                                                    {forecastError && (
                                                        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-xs text-red-700">{forecastError}</div>
                                                    )}
                                                    {forecastSuccess && (
                                                        <div className="p-3 bg-indigo-50 border-l-4 border-indigo-500 text-xs text-indigo-700 font-bold">保存しました！</div>
                                                    )}
                                                    
                                                    <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 mb-2 border border-yellow-200">
                                                        ※金額は「絶対額（円単位）」で入力してください。<br/>
                                                        （例: 15億円の場合は <code>1500000000</code> を入力）
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">対象年度名</label>
                                                            <input
                                                                type="text"
                                                                value={forecastFormData.target_year || ''}
                                                                onChange={(e) => handleForecastChange('target_year', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                                placeholder="例: 2025年度"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">売上高 (円)</label>
                                                            <input
                                                                type="number"
                                                                value={forecastFormData.forecast_net_sales ?? ''}
                                                                onChange={(e) => handleForecastChange('forecast_net_sales', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">営業利益 (円)</label>
                                                            <input
                                                                type="number"
                                                                value={forecastFormData.forecast_operating_income ?? ''}
                                                                onChange={(e) => handleForecastChange('forecast_operating_income', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">経常利益 (円)</label>
                                                            <input
                                                                type="number"
                                                                value={forecastFormData.forecast_ordinary_income ?? ''}
                                                                onChange={(e) => handleForecastChange('forecast_ordinary_income', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 sm:col-span-1">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">純利益 (円)</label>
                                                            <input
                                                                type="number"
                                                                value={forecastFormData.forecast_net_income ?? ''}
                                                                onChange={(e) => handleForecastChange('forecast_net_income', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 sm:col-span-1">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1">EPS (円)</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={forecastFormData.forecast_eps ?? ''}
                                                                onChange={(e) => handleForecastChange('forecast_eps', e.target.value)}
                                                                className="block w-full border border-gray-300 rounded shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                                placeholder="例: 125.4"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-row-reverse border-t border-gray-100">
                                        <button
                                            type="submit"
                                            disabled={isSubmittingForecast}
                                            className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                                        >
                                            {isSubmittingForecast ? '保存中...' : '予想を保存する'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowForecastModal(false)}
                                            className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto"
                                        >
                                            キャンセル
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default StockDetail;

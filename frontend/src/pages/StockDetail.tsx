import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, TrendingUp, BarChart3, Clock, AlertCircle, FolderPlus, X, LineChart as LineChartIcon, Zap } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { getStockGrowth, addPortfolioItem, getPortfolios, getStock, getStockDocuments } from '../api';
import type { Portfolio, GrowthAnalysisResponse, Stock, StockDocument } from '../api';

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

const currencyFormatter = (value: number | string | readonly (number | string)[] | undefined): string => {
    if (value === undefined || value === null) return '¥0';
    const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(numericValue);
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

    useEffect(() => {
        /**
         * 銘柄の詳細情報、財務書類、ポートフォリオ一覧、成長性データを一括で取得する
         */
        const fetchAllStockData = async () => {
            if (!code) return;
            try {
                setLoading(true);
                // 並列実行により初期ロード時間を短縮する意図
                const [stockRes, docsRes, portRes, growthRes] = await Promise.all([
                    getStock(code),
                    getStockDocuments(code),
                    getPortfolios(),
                    getStockGrowth(code)
                ]);
                
                setStock(stockRes.data);
                setPortfolios(portRes.data);
                setGrowth(growthRes.data);

                // metrics_jsonをパースして型定義済みのオブジェクトとして扱う
                const formattedDocuments = docsRes.data.map((document) => ({
                    ...document,
                    metrics: document.metrics_json ? JSON.parse(document.metrics_json) : {}
                }));
                setDocuments(formattedDocuments);
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
    const barChartFormattedData = documents.map(document => ({
        name: document.doc_id,
        sales: document.metrics?.net_sales || 0,
        operating_income: document.metrics?.operating_income || 0,
        ordinary_income: document.metrics?.ordinary_income || 0,
        net_income: document.metrics?.net_income || 0,
    }));

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
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowPortfolioModal(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <FolderPlus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        ポートフォリオに追加
                    </button>
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
                                                <span className="text-sm text-gray-600">{METRIC_DISPLAY_LABELS[item.key]}</span>
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
                                        <YAxis tickFormatter={(value) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', notation: 'compact' }).format(value)} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip
                                            formatter={currencyFormatter}
                                            cursor={{ fill: '#F3F4F6' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                        <Bar dataKey="sales" name="売上高" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="operating_income" name="営業利益" fill="#10B981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="net_income" name="純利益" fill="#6366F1" radius={[4, 4, 0, 0]} />
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
                                    {Object.entries(documents[documents.length - 1].metrics || {}).map(([key, value]) => {
                                        const isPercentageMetric = ['roe', 'roa', 'equity_ratio', 'operating_margin'].includes(key);
                                        return (
                                            <div key={key} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 transition-colors">
                                                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate" title={key}>
                                                    {METRIC_DISPLAY_LABELS[key] || key.replace(/_/g, ' ')}
                                                </dt>
                                                <dd className="mt-1 flex items-baseline gap-1">
                                                    <span className={`text-lg font-semibold ${isPercentageMetric ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {isPercentageMetric
                                                            ? Number(value).toFixed(2)
                                                            : new Intl.NumberFormat('ja-JP').format(Number(value))}
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
        </div>
    );
};

export default StockDetail;

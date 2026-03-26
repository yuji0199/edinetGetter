import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, TrendingUp, BarChart3, Clock, AlertCircle, FolderPlus, X, LineChart as LineChartIcon, Zap } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import api, { getStockGrowth } from '../api';
import type { Portfolio, GrowthAnalysisResponse } from '../api';

const METRIC_LABELS: Record<string, string> = {
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
    fcf_growth: "自己株式・フリーCF成長率", // Using requested name for growth
    sales_growth: "売上高成長率",
    profit_growth: "営利成長率",
    ordinary_growth: "経利成長率",
    net_income_growth: "純利成長率",
    dividend_growth: "配当成長率",
    cagr_sales: "売上高CAGR",
    cagr_profit: "営業益CAGR",
    fcf: "フリーキャッシュフロー (FCF)"
};

const StockDetail = () => {
    const { code } = useParams<{ code: string }>();
    const [stock, setStock] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [growth, setGrowth] = useState<GrowthAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Portfolio state
    const [showModal, setShowModal] = useState(false);
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolio, setSelectedPortfolio] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [targetPrice, setTargetPrice] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchStockData = async () => {
            if (!code) return;
            try {
                setLoading(true);
                const [stockRes, docsRes, portRes, growthRes] = await Promise.all([
                    api.get(`/stocks/${code}`),
                    api.get(`/stocks/${code}/documents`),
                    api.get('/portfolios/'),
                    getStockGrowth(code)
                ]);
                setStock(stockRes.data);
                setPortfolios(portRes.data);
                setGrowth(growthRes.data);

                // Parse metrics JSON
                const parsedDocs = docsRes.data.map((doc: any) => ({
                    ...doc,
                    metrics: doc.metrics_json ? JSON.parse(doc.metrics_json) : {}
                }));
                setDocuments(parsedDocs);
                setError(null);
            } catch (err: any) {
                console.error("Failed to fetch stock details", err);
                setError("銘柄詳細の読み込みに失敗しました。証券コードが正しいか確認してください。");
            } finally {
                setLoading(false);
            }
        };

        fetchStockData();
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

    // Format data for chart (expecting documents ordered ascending by id/date ideally)
    const chartData = documents.map(doc => ({
        name: doc.doc_id, // Could be formatted date if available
        sales: doc.metrics?.net_sales || 0,
        opIncome: doc.metrics?.operating_income || 0,
        ordIncome: doc.metrics?.ordinary_income || 0,
        netIncome: doc.metrics?.net_income || 0,
    }));

    const handleAddToPortfolio = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPortfolio || !stock) return;

        setIsSubmitting(true);
        try {
            await api.post(`/portfolios/${selectedPortfolio}/items`, {
                stock_id: stock.id,
                notes: notes,
                target_price: targetPrice || undefined
            });
            setShowModal(false);
            setNotes('');
            setTargetPrice('');
            alert('ポートフォリオに追加しました！');
        } catch (err: any) {
            alert(err.response?.data?.detail || '追加に失敗しました');
        } finally {
            setIsSubmitting(false);
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

                <div className="mt-6 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    {stock.current_price && (
                        <div className="flex gap-4 sm:gap-6 text-left sm:text-right bg-gray-50 sm:bg-transparent p-4 sm:p-0 rounded-lg w-full sm:w-auto">
                            <div>
                                <div className="text-xs text-gray-500 font-medium tracking-wide">現在株価</div>
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 border-b-2 border-primary/20 pb-0.5 mt-0.5">
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
                        onClick={() => setShowModal(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <FolderPlus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        ポートフォリオに追加
                    </button>
                </div>
            </div>

            {documents.length > 0 ? (
                <div className="space-y-8">
                    {/* Growth Analysis Section */}
                    {growth && growth.series.length > 0 && (
                        <div className="space-y-8 mt-12">
                            <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-4 py-1">
                                成長性分析 (Growth Analysis)
                            </h2>
                            
                            {/* CAGR Summary Cards */}
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
                                {/* Growth Trends Chart */}
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
                                                    formatter={(value: any) => [`${value}%`]}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                                <Line type="monotone" dataKey="sales_growth" name="売上高成長率" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="profit_growth" name="営業益成長率" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="fcf_growth" name="FCF成長率" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Growth Metrics List */}
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
                                                <span className="text-sm text-gray-600">{METRIC_LABELS[item.key]}</span>
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
                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Sales and Income Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <BarChart3 className="mr-2 h-5 w-5 text-gray-500" />
                                売上高と収益性
                                <span className="ml-2 text-xs font-normal text-gray-400 font-mono">(¥ JPY)</span>
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={(value) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', notation: 'compact' }).format(value)} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip
                                            formatter={(value: any) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Number(value))}
                                            cursor={{ fill: '#F3F4F6' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                                        <Bar dataKey="sales" name="売上高" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="opIncome" name="営業利益" fill="#10B981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="netIncome" name="純利益" fill="#6366F1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Metrics Details Table */}
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
                                        const isPercentage = ['roe', 'roa', 'equity_ratio', 'operating_margin'].includes(key);
                                        return (
                                            <div key={key} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-primary/30 transition-colors">
                                                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate" title={key}>
                                                    {METRIC_LABELS[key] || key.replace(/_/g, ' ')}
                                                </dt>
                                                <dd className="mt-1 flex items-baseline gap-1">
                                                    <span className={`text-lg font-semibold ${isPercentage ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {isPercentage
                                                            ? Number(value).toFixed(2)
                                                            : new Intl.NumberFormat('ja-JP').format(Number(value))}
                                                    </span>
                                                    {isPercentage && <span className="text-sm font-medium text-gray-500">%</span>}
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

            {/* Add to Portfolio Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowModal(false)}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                                <form onSubmit={handleAddToPortfolio}>
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
                                                    <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                                                        <X className="h-5 w-5" />
                                                    </button>
                                                </div>

                                                <div className="mt-4 space-y-4">
                                                    {/* Select Portfolio */}
                                                    <div>
                                                        <label htmlFor="portfolio" className="block text-sm font-medium text-gray-700">対象ポートフォリオ *</label>
                                                        {portfolios.length === 0 ? (
                                                            <div className="mt-1 flex items-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                                                ポートフォリオがありません。先に作成が必要です。
                                                            </div>
                                                        ) : (
                                                            <select
                                                                id="portfolio"
                                                                required
                                                                value={selectedPortfolio}
                                                                onChange={(e) => setSelectedPortfolio(Number(e.target.value))}
                                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                                            >
                                                                <option value="" disabled>-- 選択してください --</option>
                                                                {portfolios.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>

                                                    {/* Target Price */}
                                                    <div>
                                                        <label htmlFor="targetPrice" className="block text-sm font-medium text-gray-700">目標株価 (任意)</label>
                                                        <div className="mt-1 relative rounded-md shadow-sm">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <span className="text-gray-500 sm:text-sm">¥</span>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                id="targetPrice"
                                                                min="0"
                                                                value={targetPrice}
                                                                onChange={(e) => setTargetPrice(e.target.value ? Number(e.target.value) : '')}
                                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md py-2"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Notes */}
                                                    <div>
                                                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">メモ (任意)</label>
                                                        <div className="mt-1">
                                                            <textarea
                                                                id="notes"
                                                                rows={3}
                                                                value={notes}
                                                                onChange={(e) => setNotes(e.target.value)}
                                                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md py-2 px-3"
                                                                placeholder="追加する理由など..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3 flex-row-reverse sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || portfolios.length === 0 || selectedPortfolio === ''}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? '処理中...' : '追加する'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default StockDetail;

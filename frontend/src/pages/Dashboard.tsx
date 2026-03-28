import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Search, Target, TrendingUp, RefreshCw, FileText } from 'lucide-react';
import api from '../api';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/edinet/documents');
            setDocuments(res.data);
        } catch (error) {
            console.error("Failed to fetch documents", error);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2) {
                setIsSearching(true);
                try {
                    const res = await api.get(`/stocks/search?query=${searchTerm}`);
                    setSearchResults(res.data);
                    setShowResults(true);
                } catch (error) {
                    console.error("Search failed", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            // Clean up potentially mangled date string from the browser agent
            let cleanDate = targetDate;
            if (cleanDate.includes('/')) {
                cleanDate = cleanDate.replace(/\//g, '-');
            }
            // Ensure YYYY-MM-DD format roughly
            const res = await api.post(`/edinet/sync?target_date=${cleanDate}`);
            setSyncMessage(`同期処理を開始しました: ${res.data.message}`);
            // We don't call fetchDocuments() immediately because it's background
            // But we can trigger a refresh after some delay or let user do it
            setTimeout(fetchDocuments, 5000);
        } catch (error: any) {
            let errorMsg = error.message;
            if (error.response?.data?.detail) {
                errorMsg = typeof error.response.data.detail === 'string'
                    ? error.response.data.detail
                    : JSON.stringify(error.response.data.detail);
            }
            setSyncMessage(`エラー: ${errorMsg}`);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8 border-b border-gray-200 pb-5">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                    おかえりなさい、{user?.username || '投資家'}さん
                </h1>
                <p className="mt-2 text-lg text-gray-500">
                    EDINETデータでポートフォリオを管理し、新しい企業を分析しましょう。
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Search Card */}
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow relative">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                                <Search className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">銘柄検索</h3>
                                <p className="mt-1 text-sm text-gray-500">コード4桁または企業名</p>
                            </div>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="例: 7203 または トヨタ"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-2.5">
                                    <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                                </div>
                            )}
                        </div>

                        {showResults && searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 mt-2 mx-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                <ul className="divide-y divide-gray-100">
                                    {searchResults.map((stock) => (
                                        <li key={stock.id}>
                                            <Link 
                                                to={`/stocks/${stock.securities_code}`}
                                                className="block px-4 py-3 hover:bg-blue-50 transition-colors"
                                                onClick={() => setShowResults(false)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-900">{stock.company_name}</span>
                                                    <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                        {stock.securities_code}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">{stock.industry}</div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {showResults && searchTerm.length >= 2 && !isSearching && searchResults.length === 0 && (
                            <div className="absolute left-0 right-0 mt-2 mx-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 text-center text-sm text-gray-500">
                                見つかりませんでした
                            </div>
                        )}
                    </div>
                </div>

                {/* Methods Card */}
                <Link to="/analysis" className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3 group-hover:bg-indigo-200 transition-colors">
                                <Target className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">分析手法</h3>
                                <p className="mt-1 text-sm text-gray-500">独自の指標を作成・閲覧します。</p>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Portfolio Card */}
                <Link to="/portfolios" className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-emerald-100 rounded-md p-3 group-hover:bg-emerald-200 transition-colors">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">ポートフォリオ</h3>
                                <p className="mt-1 text-sm text-gray-500">パフォーマンスとランキングを確認します。</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <FileText className="mr-2 h-6 w-6 text-gray-500" />
                        最近同期された書類
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {documents.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p>書類が見つかりません。EDINETからデータを同期してください。</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企業</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">書類ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">指標</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {documents.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                <Link to={`/stocks/${doc.stock?.securities_code}`} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                                                    {doc.stock?.company_name || '不明'}
                                                    <span className="text-gray-400 text-xs ml-2">({doc.stock?.securities_code})</span>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.doc_id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 break-words max-w-xs">
                                                {doc.metrics_json ? Object.keys(JSON.parse(doc.metrics_json)).length + " 個の指標を抽出" : "データなし"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <RefreshCw className="mr-2 h-6 w-6 text-gray-500" />
                        EDINETデータ同期
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <p className="text-sm text-gray-500 mb-2">指定した日付のXBRL書類を取得・解析します。</p>
                        <div className="bg-blue-50 p-3 rounded-md mb-4 border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">取得対象</h4>
                            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                                <li>有価証券 / 四半期 / 半期 / 臨時報告書</li>
                                <li>証券コードが設定されている書類のみ</li>
                                <li>バックグラウンドで処理を実行</li>
                            </ul>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSyncing ? 'リクエスト中...' : '同期ジョブを開始'}
                        </button>

                        {syncMessage && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${syncMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                {syncMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

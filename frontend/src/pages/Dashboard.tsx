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

    useEffect(() => {
        fetchDocuments();
    }, []);

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
            const res = await api.post(`/edinet/sync?target_date=${cleanDate}&limit=3`);
            setSyncMessage(`成功: 処理完了 ${res.data.processed} 件 エラー: ${res.data.errors} 件`);
            fetchDocuments();
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
                <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                                <Search className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">銘柄検索</h3>
                                <p className="mt-1 text-sm text-gray-500">証券コードで企業を検索します。</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Methods Card */}
                <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                                <Target className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">分析手法</h3>
                                <p className="mt-1 text-sm text-gray-500">独自の指標を作成・閲覧します。</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Card */}
                <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 bg-emerald-100 rounded-md p-3">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">ポートフォリオ</h3>
                                <p className="mt-1 text-sm text-gray-500">パフォーマンスとランキングを確認します。</p>
                            </div>
                        </div>
                    </div>
                </div>
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
                        <p className="text-sm text-gray-500 mb-4">指定した日付のXBRL書類を取得・解析します。</p>

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
                            {isSyncing ? '同期中...' : '今すぐ同期 (上限: 3件)'}
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

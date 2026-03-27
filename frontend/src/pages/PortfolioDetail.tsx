import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, FolderOpen, Target, FileText } from 'lucide-react';
import api from '../api';
import type { Portfolio } from '../api';
import DeleteModal from '../components/DeleteModal';

const PortfolioDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removeError, setRemoveError] = useState<string | null>(null);

    const fetchPortfolio = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/portfolios/${id}`);
            setPortfolio(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch portfolio details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchPortfolio();
    }, [id]);

    const confirmRemoveItem = async () => {
        if (!itemToDelete) return;
        setRemoveError(null);
        try {
            await api.delete(`/portfolios/${id}/items/${itemToDelete}`);
            setItemToDelete(null);
            fetchPortfolio();
        } catch (err: any) {
            setRemoveError(err.response?.data?.detail || 'Failed to remove item');
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64">読み込み中...</div>;
    }

    if (error || !portfolio) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                    <p className="text-red-700">{error || 'Portfolio not found'}</p>
                    <Link to="/portfolios" className="text-red-700 underline mt-2 inline-block">戻る</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link to="/portfolios" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1 w-max">
                        <ArrowLeft className="h-4 w-4" />
                        ポートフォリオ一覧へ戻る
                    </Link>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold leading-6 text-gray-900 flex items-center gap-2">
                                <FolderOpen className="h-6 w-6 text-blue-600" />
                                {portfolio.name}
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm text-gray-500">
                                {portfolio.description || '説明なし'}
                            </p>
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    登録銘柄一覧 ({portfolio.items.length}件)
                </h2>

                {removeError && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 flex justify-between items-start rounded shadow-sm">
                        <div className="flex items-start">
                            <Trash2 className="h-5 w-5 text-red-500 mr-3" />
                            <div>
                                <p className="text-sm font-bold text-red-700">解除に失敗しました</p>
                                <p className="text-xs text-red-600 mt-1">{removeError}</p>
                            </div>
                        </div>
                        <button onClick={() => setRemoveError(null)} className="text-red-400 hover:text-red-700 font-bold">×</button>
                    </div>
                )}

                {portfolio.items.length === 0 ? (
                    <div className="text-center bg-gray-50 rounded-lg py-12 border border-gray-200">
                        <p className="text-gray-500">まだ銘柄が登録されていません。</p>
                        <p className="text-sm text-gray-400 mt-2">ダッシュボードや銘柄検索から企業を探して追加してください。</p>
                        <Link
                            to="/"
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            銘柄を探す
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        証券コード / 企業名
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        業種
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        目標株価
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        メモ
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        追加日
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">操作</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {portfolio.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div>
                                                    <Link to={`/stock/${item.stock?.securities_code}`} className="text-sm font-medium text-blue-600 hover:text-blue-900">
                                                        {item.stock?.company_name || '名称不明'}
                                                    </Link>
                                                    <div className="text-sm text-gray-500">{item.stock?.securities_code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {item.stock?.industry || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.target_price ? (
                                                <span className="flex items-center gap-1 font-medium text-green-600">
                                                    <Target className="h-4 w-4" />
                                                    ¥{item.target_price.toLocaleString()}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.notes ? (
                                                <span className="truncate max-w-xs block" title={item.notes}>{item.notes}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(item.added_at).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setItemToDelete(item.id);
                                                }}
                                                className="text-red-600 hover:text-red-900 ml-4 inline-flex items-center gap-1 bg-red-50 px-2 py-1 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                解除
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <DeleteModal
                isOpen={itemToDelete !== null}
                title="銘柄の解除"
                message="本当にこの銘柄をポートフォリオから外しますか？"
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmRemoveItem}
            />
        </>
    );
};

export default PortfolioDetail;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Plus, Trash2, ArrowRight } from 'lucide-react';
import api from '../api';
import type { Portfolio } from '../api';
import DeleteModal from '../components/DeleteModal';

const Portfolios: React.FC = () => {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const [portfolioToDelete, setPortfolioToDelete] = useState<number | null>(null);

    // Create new portfolio state
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const fetchPortfolios = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/portfolios/');
            setPortfolios(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch portfolios');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const handleCreatePortfolio = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setOperationError(null);
        try {
            await api.post('/portfolios/', {
                name: newName,
                description: newDescription
            });
            setNewName('');
            setNewDescription('');
            setIsCreating(false);
            fetchPortfolios();
        } catch (err: any) {
            setOperationError(err.response?.data?.detail || 'Failed to create portfolio');
        }
    };

    const confirmDeletePortfolio = async () => {
        if (!portfolioToDelete) return;

        setOperationError(null);
        try {
            await api.delete(`/portfolios/${portfolioToDelete}`);
            setPortfolioToDelete(null);
            fetchPortfolios();
        } catch (err: any) {
            setOperationError(err.response?.data?.detail || 'Failed to delete portfolio');
        }
    };

    if (isLoading && portfolios.length === 0) {
        return <div className="flex justify-center items-center h-64">読み込み中...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Folder className="h-8 w-8 text-blue-600" />
                        マイポートフォリオ
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">お気に入りの銘柄や保有株をグループ化して管理します。</p>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(!isCreating);
                        setOperationError(null);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                    新しいポートフォリオ
                </button>
            </div>

            {operationError && (
                <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 flex justify-between items-start rounded shadow-sm">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <Plus className="h-5 w-5 text-red-400 rotate-45" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-bold text-red-700">エラーが発生しました</p>
                            <p className="text-xs text-red-600 mt-1">{operationError}</p>
                        </div>
                    </div>
                    <button onClick={() => setOperationError(null)} className="text-red-400 hover:text-red-700 font-bold">×</button>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {isCreating && (
                <div className="bg-white shadow sm:rounded-lg mb-8 p-6 border border-blue-100">
                    <form onSubmit={handleCreatePortfolio}>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">ポートフォリオ名</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    required
                                    placeholder="例: 高配当バリュー株"
                                />
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">説明 (任意)</label>
                                <input
                                    type="text"
                                    id="description"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="配当利回り4%以上の銘柄を集めたリスト"
                                />
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                作成する
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {portfolios.length === 0 && !isLoading && !isCreating ? (
                <div className="text-center bg-gray-50 rounded-lg py-12 border-2 border-dashed border-gray-300">
                    <Folder className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">ポートフォリオがありません</h3>
                    <p className="mt-1 text-sm text-gray-500">新しいポートフォリオを作成して、銘柄の管理を始めましょう。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {portfolios.map((portfolio) => (
                        <div key={portfolio.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col">
                            <div className="p-5 flex-grow">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 truncate" title={portfolio.name}>
                                        {portfolio.name}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPortfolioToDelete(portfolio.id);
                                        }}
                                        className="text-gray-400 hover:text-red-500"
                                        title="削除"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-500 h-10 overflow-hidden text-ellipsis">
                                    {portfolio.description || '説明なし'}
                                </p>
                                <div className="mt-4 flex items-center text-sm text-gray-500">
                                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                        登録銘柄: {portfolio.items?.length || 0}件
                                    </span>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
                                <Link
                                    to={`/portfolios/${portfolio.id}`}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center justify-between"
                                >
                                    詳細を表示して銘柄を管理
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <DeleteModal
                isOpen={portfolioToDelete !== null}
                title="ポートフォリオの削除"
                message="このポートフォリオと、含まれる銘柄リストをすべて削除してもよろしいですか？"
                onClose={() => setPortfolioToDelete(null)}
                onConfirm={confirmDeletePortfolio}
            />
        </div>
    );
};

export default Portfolios;

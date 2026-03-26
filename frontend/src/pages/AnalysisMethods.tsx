import React, { useState, useEffect } from 'react';
import { getAnalysisMethods, createAnalysisMethod, deleteAnalysisMethod, runScreening } from '../api';
import type { AnalysisMethod, ScreeningResult } from '../api';

const AnalysisMethods: React.FC = () => {
    const [methods, setMethods] = useState<AnalysisMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Conditions state
    const [conditions, setConditions] = useState([{ metric: 'net_sales', operator: '>=', value: '' }]);

    // Screening results
    const [results, setResults] = useState<ScreeningResult[] | null>(null);
    const [screeningLoading, setScreeningLoading] = useState(false);

    // Delete Modal state
    const [methodToDelete, setMethodToDelete] = useState<number | null>(null);

    const availableMetrics = [
        { value: 'net_sales', label: '売上高 (Net Sales)' },
        { value: 'operating_income', label: '営業利益 (Operating Income)' },
        { value: 'ordinary_income', label: '経常利益 (Ordinary Income)' },
        { value: 'net_income', label: '当期純利益 (Net Income)' },
        { value: 'total_assets', label: '総資産 (Total Assets)' },
        { value: 'net_assets', label: '純資産 (Net Assets)' },
        { value: 'operating_cf', label: '営業CF (Operating CF)' },
        { value: 'investing_cf', label: '投資CF (Investing CF)' },
        { value: 'financing_cf', label: '財務CF (Financing CF)' },
        { value: 'eps', label: '1株当たり純利益 (EPS)' },
        { value: 'bps', label: '1株当たり純資産 (BPS)' },
        { value: 'roe', label: '自己資本利益率 (ROE) %' },
        { value: 'roa', label: '総資産利益率 (ROA) %' },
        { value: 'equity_ratio', label: '自己資本比率 %' },
        { value: 'operating_margin', label: '営業利益率 %' },
        { value: 'sales_growth', label: '売上高成長率 %' },
        { value: 'profit_growth', label: '営業益成長率 %' },
        { value: 'ordinary_growth', label: '経常益成長率 %' },
        { value: 'net_income_growth', label: '純利益成長率 %' },
        { value: 'dividend_growth', label: '配当成長率 %' },
        { value: 'fcf_growth', label: 'FCF成長率 %' },
        { value: 'cagr_sales', label: '売上高CAGR %' },
        { value: 'cagr_profit', label: '営業益CAGR %' },
        { value: 'fcf', label: 'フリーキャッシュフロー (FCF)' },
    ];

    const fetchMethods = async () => {
        try {
            setLoading(true);
            const response = await getAnalysisMethods();
            setMethods(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch methods');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMethods();
    }, []);

    const handleAddCondition = () => {
        setConditions([...conditions, { metric: 'net_sales', operator: '>=', value: '' }]);
    };

    const handleRemoveCondition = (index: number) => {
        const newConditions = [...conditions];
        newConditions.splice(index, 1);
        setConditions(newConditions);
    };

    const handleConditionChange = (index: number, field: string, value: string) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], [field]: value };
        setConditions(newConditions);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Validate conditions
            const validConditions = conditions.filter(c => c.metric && c.operator && c.value !== '');
            if (validConditions.length === 0) {
                alert('少なくとも1つの有効な条件を追加してください。');
                return;
            }

            // Convert string values to numbers
            const parsedConditions = validConditions.map(c => ({
                ...c,
                value: Number(c.value)
            }));

            await createAnalysisMethod({
                name,
                description,
                conditions_json: JSON.stringify(parsedConditions)
            });

            // Reset form
            setName('');
            setDescription('');
            setConditions([{ metric: 'net_sales', operator: '>=', value: '' }]);

            // Refresh list
            fetchMethods();
        } catch (err: any) {
            alert('作成に失敗しました: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleDeleteClick = (id: number) => {
        setMethodToDelete(id);
    };

    const confirmDelete = async () => {
        if (methodToDelete === null) return;
        try {
            await deleteAnalysisMethod(methodToDelete);
            setMethodToDelete(null);
            fetchMethods();
        } catch (err: any) {
            console.error(err);
            alert('削除に失敗しました: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleRunScreening = async (id: number) => {
        try {
            setScreeningLoading(true);
            setResults(null);
            const response = await runScreening(id);
            setResults(response.data);
        } catch (err: any) {
            alert('スクリーニングに失敗しました: ' + (err.response?.data?.detail || err.message));
        } finally {
            setScreeningLoading(false);
        }
    };

    const formatMetric = (key: string, value: number | undefined) => {
        if (value === undefined || value === null) return '-';
        const isPercentage = ['roe', 'roa', 'equity_ratio', 'operating_margin'].includes(key) || key.endsWith('_growth') || key.startsWith('cagr_');
        if (isPercentage) {
            return `${value.toFixed(2)}%`;
        }
        if (['eps', 'bps'].includes(key)) {
            return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
        }
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 border-b pb-2">分析手法 (Analysis Methods)</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Create Form */}
                <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-primary">新規手法の作成</h2>
                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">手法名</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary focus:border-primary" placeholder="例: 高収益グロース株" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">説明 (任意)</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary focus:border-primary" rows={2} />
                            </div>

                            <div className="pt-4 border-t">
                                <label className="block text-sm font-medium text-gray-700 mb-2">スクリーニング条件 (AND条件)</label>
                                {conditions.map((cond, index) => (
                                    <div key={index} className="flex gap-2 mb-2 items-center bg-gray-50 p-2 rounded">
                                        <select value={cond.metric} onChange={(e) => handleConditionChange(index, 'metric', e.target.value)} className="block w-1/3 border border-gray-300 rounded-md shadow-sm p-1 text-sm bg-white">
                                            {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                        <select value={cond.operator} onChange={(e) => handleConditionChange(index, 'operator', e.target.value)} className="block w-1/4 border border-gray-300 rounded-md shadow-sm p-1 text-center font-mono bg-white">
                                            <option value=">=">&gt;=</option>
                                            <option value="<=">&lt;=</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value="==">==</option>
                                        </select>
                                        <input type="number" value={cond.value} onChange={(e) => handleConditionChange(index, 'value', e.target.value)} required placeholder="数値" className="block w-1/3 border border-gray-300 rounded-md shadow-sm p-1 font-mono text-right" />
                                        <button type="button" onClick={() => handleRemoveCondition(index)} className="text-red-500 hover:text-red-700 p-1 font-bold" disabled={conditions.length === 1}>×</button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddCondition} className="mt-2 text-sm text-primary hover:text-primary-dark flex items-center">
                                    + 条件を追加
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 mt-4">
                            <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                保存する
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Column: Methods List & Results */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">保存済み手法</h2>
                        {loading ? (
                            <p className="text-gray-500">読み込み中...</p>
                        ) : error ? (
                            <p className="text-red-500">{error}</p>
                        ) : methods.length === 0 ? (
                            <p className="text-gray-500 italic">保存された手法はありません。</p>
                        ) : (
                            <div className="space-y-4">
                                {methods.map(method => (
                                    <div key={method.id} className="border rounded p-4 flex justify-between items-start bg-gray-50 hover:bg-white transition-colors">
                                        <div>
                                            <h3 className="font-bold text-lg text-primary">{method.name}</h3>
                                            {method.description && <p className="text-sm text-gray-600 mt-1">{method.description}</p>}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {JSON.parse(method.conditions_json).map((c: any, i: number) => (
                                                    <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 font-mono">
                                                        {c.metric} {c.operator} {c.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRunScreening(method.id); }} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow-sm transition-colors text-center">
                                                実行 (Screen)
                                            </button>
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(method.id); }} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors text-center">
                                                削除
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Results Table */}
                    {(results || screeningLoading) && (
                        <div className="bg-white shadow rounded-lg p-6 border-t-4 border-green-500">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800">スクリーニング結果</h2>
                                {results && <span className="text-sm font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full">{results.length} 銘柄が合致</span>}
                            </div>

                            {screeningLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    <p className="mt-2 text-gray-600">データベースを検索中...</p>
                                </div>
                            ) : results && results.length === 0 ? (
                                <p className="text-gray-600 text-center py-4 bg-gray-50 rounded">条件に合致する銘柄は見つかりませんでした。</p>
                            ) : results && (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 border">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">証券コード</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企業名</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最新書類の発行日</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">合致した指標</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.map((result, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-gray-900">{result.stock.securities_code}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary">{result.stock.company_name}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {result.submit_datetime ? new Date(result.submit_datetime).toLocaleDateString('ja-JP') : '不明'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right align-top">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {Object.entries(result.metrics).map(([key, value]) => (
                                                                <span key={key} className="inline-block bg-gray-50 px-2 py-1 rounded text-xs font-mono border">
                                                                    <span className="text-gray-500 mr-1">{key}:</span>
                                                                    {formatMetric(key, value)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {methodToDelete !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold mb-4 text-gray-900">手法の削除</h3>
                        <p className="text-gray-600 mb-6">この手法を削除してもよろしいですか？</p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setMethodToDelete(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                            >
                                削除する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisMethods;

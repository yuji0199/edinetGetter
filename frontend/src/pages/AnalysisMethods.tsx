import React, { useState, useEffect } from 'react';
import { getAnalysisMethods, createAnalysisMethod, deleteAnalysisMethod, runScreening } from '../api';
import type { AnalysisMethod, ScreeningResult } from '../api';

/**
 * スクリーニング条件の単一項目を定義するインターフェース
 */
interface ScreeningCondition {
    metric: string;
    operator: string;
    value: string | number;
}

/**
 * 分析手法管理・スクリーニング実行画面コンポーネント
 * ユーザーが独自の投資尺度（手法）を定義し、全銘柄から条件に合致するものを抽出する機能を提供
 */
const AnalysisMethods: React.FC = () => {
    // 保存済み手法の一覧と取得状態の管理
    const [methods, setMethods] = useState<AnalysisMethod[]>([]);
    const [isLoadingMethods, setIsLoadingMethods] = useState<boolean>(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // 新規手法作成用のフォーム状態
    const [newMethodName, setNewMethodName] = useState<string>('');
    const [newMethodDescription, setNewMethodDescription] = useState<string>('');
    const [newConditions, setNewConditions] = useState<ScreeningCondition[]>([
        { metric: 'net_sales', operator: '>=', value: '' }
    ]);

    // スクリーニング実行結果と実行状態の管理
    const [screeningResults, setScreeningResults] = useState<ScreeningResult[] | null>(null);
    const [isScreeningProcessing, setIsScreeningProcessing] = useState<boolean>(false);
    const [screeningError, setScreeningError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // 削除確認モーダル用の手法ID
    const [targetIdToDelete, setTargetIdToDelete] = useState<number | null>(null);

    /**
     * スクリーニングで選択可能な財務指標のリスト
     * ユーザーが直感的に選択できるよう、日本語ラベルを付与
     */
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

    /**
     * 保存済み手法一覧を取得し、画面を更新する
     */
    const loadAnalysisMethods = async () => {
        try {
            setIsLoadingMethods(true);
            const response = await getAnalysisMethods();
            setMethods(response.data);
            setFetchError(null);
        } catch (err: any) {
            setFetchError(err.message || '分析手法の取得に失敗しました。');
        } finally {
            setIsLoadingMethods(false);
        }
    };

    useEffect(() => {
        loadAnalysisMethods();
    }, []);

    /**
     * 入力フォームに新しいスクリーニング条件行を追加する
     */
    const handleAddConditionRow = () => {
        setNewConditions([...newConditions, { metric: 'net_sales', operator: '>=', value: '' }]);
    };

    /**
     * 指定されたインデックスの条件行を削除する
     */
    const handleRemoveConditionRow = (index: number) => {
        const updatedConditions = [...newConditions];
        updatedConditions.splice(index, 1);
        setNewConditions(updatedConditions);
    };

    /**
     * 条件行のフィールド値が変更された際のハンドラ
     */
    const handleConditionFieldValueChange = (index: number, field: keyof ScreeningCondition, value: string) => {
        const updatedConditions = [...newConditions];
        updatedConditions[index] = { ...updatedConditions[index], [field]: value };
        setNewConditions(updatedConditions);
    };

    /**
     * 手法の新規保存。バリデーション後にJSON形式でAPIに送信する
     */
    const handleCreateMethodSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            // 空の値を入力している条件を除外してバリデーション
            const validConditions = newConditions.filter(cond => cond.metric && cond.operator && cond.value !== '');
            if (validConditions.length === 0) {
                alert('データが入力された有効な条件を少なくとも1つ追加してください。');
                return;
            }

            // スクリーニングエンジンは数値として評価するため、入力を数値に変換
            const parsedConditions = validConditions.map(cond => ({
                ...cond,
                value: Number(cond.value)
            }));

            setSaveError(null);
            await createAnalysisMethod({
                name: newMethodName,
                description: newMethodDescription,
                conditions_json: JSON.stringify(parsedConditions)
            });

            // 保存完了後は、混乱を避けるために入力フォームを初期状態に戻す
            setNewMethodName('');
            setNewMethodDescription('');
            setNewConditions([{ metric: 'net_sales', operator: '>=', value: '' }]);
            await loadAnalysisMethods();
        } catch (err: any) {
            setSaveError(err.response?.data?.detail || err.message || '手法の保存中に不明なエラーが発生しました。');
        }
    };

    /**
     * スクリーニング実行をトリガーする。
     * 実行中はローディング表示を行い、結果をテーブルに展開する。
     */
    const triggerScreeningProcess = async (methodId: number) => {
        try {
            setIsScreeningProcessing(true);
            setScreeningResults(null);
            setScreeningError(null);
            const response = await runScreening(methodId);
            setScreeningResults(response.data);
        } catch (err: any) {
            setScreeningError(err.response?.data?.detail || err.message || 'スクリーニング処理中に不明なエラーが発生しました。');
        } finally {
            setIsScreeningProcessing(false);
        }
    };

    /**
     * 財務指標の性質（%か金額か）に応じて単位や桁数を整形する
     */
    const formatMetricValue = (key: string, value: number | undefined) => {
        if (value === undefined || value === null) return '-';
        
        // 成長率や利率などは小数点2桁固定のパーセント表示にする意図
        const isPercentageMetric = ['roe', 'roa', 'equity_ratio', 'operating_margin'].includes(key) || key.endsWith('_growth') || key.startsWith('cagr_');
        if (isPercentageMetric) {
            return `${value.toFixed(2)}%`;
        }
        
        // EPS/BPSは1円以上の場合が多いが、株価との比較のため小数点も表示。その他は整数表示。
        if (['eps', 'bps'].includes(key)) {
            return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
        }
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 border-b pb-2">分析手法 (Analysis Methods)</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 左カラム: 新規手法の定義フォーム */}
                <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-primary">新規手法の作成</h2>

                    {saveError && (
                        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 flex justify-between items-start">
                            <div>
                                <p className="text-sm font-bold text-red-700">保存に失敗しました</p>
                                <p className="text-xs text-red-600 mt-1">{saveError}</p>
                            </div>
                            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                        </div>
                    )}

                    <form onSubmit={handleCreateMethodSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">手法名</label>
                                <input type="text" value={newMethodName} onChange={(e) => setNewMethodName(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="例: 高収益グロース株" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">説明 (任意)</label>
                                <textarea value={newMethodDescription} onChange={(e) => setNewMethodDescription(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" rows={2} />
                            </div>

                            <div className="pt-4 border-t">
                                <label className="block text-sm font-medium text-gray-700 mb-2">スクリーニング条件 (AND条件)</label>
                                {newConditions.map((cond, index) => (
                                    <div key={index} className="flex gap-2 mb-2 items-center bg-gray-50 p-2 rounded">
                                        <select value={cond.metric} onChange={(e) => handleConditionFieldValueChange(index, 'metric', e.target.value)} className="block w-1/3 border border-gray-300 rounded-md shadow-sm p-1 text-sm bg-white">
                                            {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                        <select value={cond.operator} onChange={(e) => handleConditionFieldValueChange(index, 'operator', e.target.value)} className="block w-1/4 border border-gray-300 rounded-md shadow-sm p-1 text-center font-mono bg-white">
                                            <option value=">=">&gt;=</option>
                                            <option value="<=">&lt;=</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value="==">==</option>
                                        </select>
                                        <input type="number" value={cond.value} onChange={(e) => handleConditionFieldValueChange(index, 'value', e.target.value)} required placeholder="数値" className="block w-1/3 border border-gray-300 rounded-md shadow-sm p-1 font-mono text-right" />
                                        <button type="button" onClick={() => handleRemoveConditionRow(index)} className="text-red-500 hover:text-red-700 p-1 font-bold" disabled={newConditions.length === 1}>×</button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddConditionRow} className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center">
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

                {/* 右カラム: 保存済み手法の一覧表示と実行結果 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">保存済み手法</h2>
                        {isLoadingMethods ? (
                            <p className="text-gray-500">読み込み中...</p>
                        ) : fetchError ? (
                            <p className="text-red-500">{fetchError}</p>
                        ) : methods.length === 0 ? (
                            <p className="text-gray-500 italic">保存された手法はありません。</p>
                        ) : (
                            <div className="space-y-4">
                                {methods.map(method => (
                                    <div key={method.id} className="border rounded p-4 flex justify-between items-start bg-gray-50 hover:bg-white transition-colors">
                                        <div>
                                            <h3 className="font-bold text-lg text-blue-700">{method.name}</h3>
                                            {method.description && <p className="text-sm text-gray-600 mt-1">{method.description}</p>}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {JSON.parse(method.conditions_json).map((c: ScreeningCondition, i: number) => (
                                                    <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 font-mono">
                                                        {availableMetrics.find(m => m.value === c.metric)?.label || c.metric} {c.operator} {c.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button type="button" onClick={() => triggerScreeningProcess(method.id)} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow-sm transition-colors text-center">
                                                実行 (Screen)
                                            </button>
                                            <button type="button" onClick={() => setTargetIdToDelete(method.id)} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors text-center">
                                                削除
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* スクリーニングの実行結果テーブル */}
                    {(screeningResults || isScreeningProcessing || screeningError) && (
                        <div className="bg-white shadow rounded-lg p-6 border-t-4 border-green-500">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800">スクリーニング結果</h2>
                                {screeningResults && <span className="text-sm font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full">{screeningResults.length} 銘柄が合致</span>}
                            </div>

                            {screeningError && (
                                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-bold text-red-700">スクリーニングに失敗しました</p>
                                        <p className="text-xs text-red-600 mt-1">{screeningError}</p>
                                    </div>
                                    <button onClick={() => setScreeningError(null)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                </div>
                            )}

                            {isScreeningProcessing ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-2 text-gray-600">データベースを検索中...</p>
                                </div>
                            ) : screeningResults && screeningResults.length === 0 ? (
                                <p className="text-gray-600 text-center py-4 bg-gray-50 rounded">条件に合致する銘柄は見つかりませんでした。</p>
                            ) : (
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
                                            {screeningResults?.map((result, index) => (
                                                <tr key={index} className="hover:bg-blue-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-gray-900">{result.stock.securities_code}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                                                        <a href={`/stocks/${result.stock.securities_code}`} target="_blank" rel="noopener noreferrer">
                                                            {result.stock.company_name}
                                                        </a>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {result.submit_datetime ? new Date(result.submit_datetime).toLocaleDateString('ja-JP') : '不明'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right align-top">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {Object.entries(result.metrics).map(([key, value]) => (
                                                                <span key={key} className="inline-block bg-gray-50 px-2 py-1 rounded text-xs font-mono border">
                                                                    <span className="text-gray-500 mr-1">{key}:</span>
                                                                    {formatMetricValue(key, value)}
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

            {/* 削除確認用モーダル */}
            {targetIdToDelete !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold mb-4 text-gray-900">手法の削除</h3>
                        <p className="text-gray-600 mb-6">この手法を削除してもよろしいですか？</p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setTargetIdToDelete(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await deleteAnalysisMethod(targetIdToDelete);
                                    setTargetIdToDelete(null);
                                    loadAnalysisMethods();
                                }}
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

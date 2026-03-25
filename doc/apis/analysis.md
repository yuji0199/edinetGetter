# 分析手法関連API

## [API008] 分析手法一覧取得

ログインユーザーが作成したすべての分析手法を取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/analysis`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-07 | 全体 | 新規作成 | yuji |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | 手法ID |
| 2 | name | String | 手法名 |
| 3 | description | String | 説明 |
| 4 | conditions_json | String | スクリーニング条件（JSON文字列） |

</div>

**処理詳細**
<div class="api-logic">

1. 手法一覧の取得
   - `analysis_methods` テーブルから `user_id` が一致するレコードを全件取得
   →項目名: 手法リストを返却（処理終了）

</div>

---

## [API009] 分析手法作成

新しい分析手法を保存します。

**基本情報**
* **Method**: POST
* **Path**: `/api/analysis`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-07 | 全体 | 新規作成 | yuji |

</div>

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Body | name | String | ○ | 最大：50桁 |
| 2 | Body | description | String | - | 最大：200桁 |
| 3 | Body | conditions_json | String | ○ | 形式：JSON配列 |

</div>

**処理詳細**
<div class="api-logic">

1. バリデーションチェック
   - `conditions_json` が正しいJSON形式か確認する
   →不正な場合: エラー（400 Bad Request）を返却
2. 分析手法の登録
   - `analysis_methods` テーブルに新規レコードを挿入
   →項目名: 作成された手法情報を返却（処理終了）

</div>

---

## [API010] 分析手法削除

指定した分析手法を削除します。

**基本情報**
* **Method**: DELETE
* **Path**: `/api/analysis/{method_id}`
* **認証**: 必要

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Path | method_id | Number | ○ | 手法ID |

</div>

**処理詳細**
<div class="api-logic">

1. 所有権の確認
   - `analysis_methods` テーブルから `id` 且つ `user_id` が一致するレコードを検索
   →存在しない場合: エラー（404 Not Found）を返却
2. 手法の削除
   - 該当レコードを削除
   →（処理終了）

</div>

---

## [API011] スクリーニング実行

指定した分析手法の条件に基づき、全銘柄をスクリーニングします。

**基本情報**
* **Method**: POST
* **Path**: `/api/analysis/{method_id}/screen`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-07 | 全体 | 新規作成 | yuji |
| 2 | 2026-03-25 | ロジック | YoY成長率の計算・判定ロジックを追加 | antigravity |

</div>

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Path | method_id | Number | ○ | 実行する手法のID |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | stock | Object | 銘柄情報 |
| 2 | document_id | String | 判定に使用した書類ID |
| 3 | metrics | Object | 条件合致時の実績値リスト |

</div>

**処理詳細**
<div class="api-logic">

1. 手法条件の取得
   - `analysis_methods` より条件リストをロードしてパース
2. 最新書類の特定
   - `financial_documents` テーブルを `stock_id` ごとにグループ化し、各銘柄の最新（最大ID）の書類を抽出
3. 条件評価（銘柄ごとのループ）
   - `metrics_json` をパース
   - **成長率指標（YoY）が含まれる場合**:
     - 対象銘柄の「1期前」の財務書類を取得し、指標値を比較して成長率を算出する
   - すべての条件（AND）をチェックし、指標の比較演算（>=, <=, == 等）を実行
4. 合致銘柄の収集
   - 条件をすべて満たす銘柄について、基本情報と実績値をリストへ追加
   →項目名: 合致した銘柄リストを返却（処理終了）

</div>

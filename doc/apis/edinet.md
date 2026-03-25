# EDINETデータ関連API

## [API004] データ同期リクエスト

指定した日付のEDINETデータをバックグラウンドで同期します。

**基本情報**
* **Method**: POST
* **Path**: `/api/edinet/sync`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-21 | 全体 | 新規作成（BackgroundTasks対応） | yuji |
| 2 | 2026-03-24 | フィルタ | 有報・四半期等の限定取得フィルタを適用 | yuji |

</div>

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Query | target_date | String | ○ | 形式：YYYY-MM-DD |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | message | String | 処理開始メッセージ |

</div>

**処理詳細**
<div class="api-logic">

1. 同期タスクの登録
   - FastAPIの `BackgroundTasks` に `run_full_sync(target_date)` を追加
   →画面表示：同期処理を開始した旨のメッセージを返却（処理終了）

※実際の同期処理（`run_full_sync`）の内部ロジック：
1. EDINET API 呼び出し
   - `services.edinet.EdinetClient.get_document_list` をコール
   - **フィルタ**: 有価証券、四半期、半期、臨時報告書のみを取得
2. ドキュメントのダウンロードと解析
   - 各書類のZIPをダウンロード
   - `services.xbrl.XBRLParser` で財務数値（売上高、利益等）を抽出
3. データの保存
   - `stocks` テーブル、`financial_documents` テーブルへ保存
   - DB項目: `financial_documents.metrics_json` に解析結果を保存

</div>

---

## [API005] 最近の同期書類取得

最近同期されたドキュメントのリストを最大100件取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/edinet/documents`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-22 | 全体 | 新規作成 | yuji |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | 書類管理ID |
| 2 | doc_id | String | EDINET書類ID |
| 3 | submit_datetime | String | 提出日時 |
| 4 | stock | Object | 関連する銘柄情報 |
| 5 | stock.securities_code | String | 証券コード |
| 6 | stock.company_name | String | 企業名 |

</div>

**処理詳細**
<div class="api-logic">

1. 書類データの取得
   - `financial_documents` テーブルから `id` 降順で取得
   - 取得条件: `limit=100`
   - `stocks` テーブルを結合（Joined Load）して企業名等を含める
   →項目名: 書類リストを返却（処理終了）

</div>

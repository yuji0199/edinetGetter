# 銘柄・財務データ関連API

## [API006] 銘柄検索

登録されている銘柄の一覧を取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/stocks`
* **認証**: 不要

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
| 1 | Query | skip | Number | - | デフォルト: 0 |
| 2 | Query | limit | Number | - | デフォルト: 100 |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | 銘柄内部ID |
| 2 | securities_code | String | 証券コード |
| 3 | company_name | String | 企業名 |
| 4 | industry | String | 業種 |

</div>

**処理詳細**
<div class="api-logic">

1. 銘柄一覧の取得
   - `stocks` テーブルからレコードを取得
   - 取得条件: `skip`, `limit` に基づくページング
   →項目名: 銘柄リストを返却（処理終了）

</div>

---

## [API007] 銘柄詳細・財務データ取得

特定の銘柄の基本情報、リアルタイム株価、および最新の財務指標（PER, PBR等）を取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/stocks/{securities_code}`
* **認証**: 不要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-07 | 全体 | 新規作成 | yuji |
| 2 | 2026-03-11 | 指標 | PER, PBRの計算ロジックを追加 | yuji |

</div>

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Path | securities_code | String | ○ | 証券コード（4桁） |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | \&nbsp; |
| 2 | securities_code | String | \&nbsp; |
| 3 | company_name | String | \&nbsp; |
| 4 | industry | String | \&nbsp; |
| 5 | current_price | Number | リアルタイム株価（yfinanceより） |
| 6 | per | Number | 株価 / EPS |
| 7 | pbr | Number | 株価 / BPS |

</div>

**処理詳細**
<div class="api-logic">

1. 銘柄情報の取得
   - `stocks` テーブルから `securities_code` で検索
   →存在しない場合: エラー（404 Not Found）を返却
2. リアルタイム価格の取得
   - `yfinance` を使用して現在の市場価格を取得
3. 最新の財務ドキュメント取得
   - `financial_documents` テーブルから最新の1件を取得
4. 指標の計算
   - `financial_documents.metrics_json` から `eps`, `bps` を抽出
   - 以下の式で計算：
     - `per = current_price / eps`
     - `pbr = current_price / bps`
   →項目名: `current_price`, `per`, `pbr` 等を含む詳細情報を返却（処理終了）

</div>

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
---
117: 
118: ## [API018] 成長性分析データの取得
119: 
120: 過去数年間の財務データに基づき、売上高および利益の成長率（YoY）と年平均成長率（CAGR）を取得します。
121: 
122: **基本情報**
123: * **Method**: GET
124: * **Path**: `/api/stocks/{securities_code}/growth`
125: * **認証**: 不要
126: 
127: **変更履歴**
128: <div class="log">
129: 
130: | No | 変更日 | 変更セクション | 変更項目 | 変更者 |
131: | :--- | :--- | :--- | :--- | :--- |
132: | 1 | 2026-03-25 | 全体 | 新規作成 | antigravity |
133: 
134: </div>
135: 
136: **リクエストパラメータ**
137: <div class="api-request">
138: 
139: | No | 場所 | 項目名 | 型 | 必須 | 備考 |
140: | :--- | :--- | :--- | :--- | :--- | :--- |
141: | 1 | Path | securities_code | String | ○ | 証券コード（4桁） |
142: | 2 | Query | years | Number | - | 計算対象年数（デフォルト: 5） |
143: 
144: </div>
145: 
146: **レスポンス**
147: <div class="api-response">
148: 
149: | No | 項目名 | 型 | 備考 |
150: | :--- | :--- | :--- | :--- |
151: | 1 | series | Array | 年度ごとのデータリスト |
152: | 1.1 | year | String | 会計年度（例: "2023"） |
153: | 1.2 | sales | Number | 売上高 |
154: | 1.3 | sales_growth | Number | 売上高成長率 (%) |
155: | 1.4 | profit | Number | 営業利益 |
156: | 1.5 | profit_growth | Number | 営業利益成長率 (%) |
157: | 2 | cagr_sales | Number | 売上高の年平均成長率 (%) |
158: | 3 | cagr_profit | Number | 営業利益の年平均成長率 (%) |
159: 
160: </div>
161: 
162: **処理詳細**
163: <div class="api-logic">
164: 
165: 1. 銘柄情報の取得
166:    - `stocks` テーブルから `securities_code` で検索
167:    →存在しない場合: エラー（404 Not Found）を返却
168: 2. 過去の財務ドキュメント取得
169:    - `financial_documents` テーブルから対象銘柄のデータを過去 `years` 分取得
170:    - 取得条件: `submit_datetime` の降順
171: 3. データの整理と計算
172:    - 年度ごとの `net_sales`, `operating_income` を抽出
173:    - 前年比（YoY）を算出： `(当年 - 前年) / 前年 * 100`
174:    - CAGRを算出： `((最新値 / 最古値) ^ (1 / 年数) - 1) * 100`
175:    →項目名: `series`, `cagr_sales`, `cagr_profit` を返却（処理終了）
176: 
177: </div>

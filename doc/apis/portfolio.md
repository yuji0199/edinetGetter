# ポートフォリオ関連API

## [API012] ポートフォリオ一覧取得

ログインユーザーが作成したすべてのポートフォリオを取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/portfolios`
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
| 1 | id | Number | ポートフォリオID |
| 2 | name | String | ポートフォリオ名 |
| 3 | description | String | 説明 |

</div>

**処理詳細**
<div class="api-logic">

1. ポートフォリオ一覧の取得
   - `portfolios` テーブルから `user_id` が一致するレコードを全件取得
   →項目名: ポートフォリオリストを返却（処理終了）

</div>

---

## [API013] ポートフォリオ作成

新しいポートフォリオを作成します。

**基本情報**
* **Method**: POST
* **Path**: `/api/portfolios`
* **認証**: 必要

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Body | name | String | ○ | 最大：50桁 |
| 2 | Body | description | String | - | 最大：200桁 |

</div>

**処理詳細**
<div class="api-logic">

1. ポートフォリオの登録
   - `portfolios` テーブルに新規レコードを挿入
   →項目名: 作成されたポートフォリオ情報を返却（処理終了）

</div>

---

## [API014] ポートフォリオ削除

指定したポートフォリオを削除します。

**基本情報**
* **Method**: DELETE
* **Path**: `/api/portfolios/{portfolio_id}`
* **認証**: 必要

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Path | portfolio_id | Number | ○ | 削除対象のID |

</div>

**処理詳細**
<div class="api-logic">

1. 所有権の確認
   - `portfolios` テーブルから `id` 且つ `user_id` が一致するレコードを検索
   →存在しない場合: エラー（404 Not Found）を返却
2. ポートフォリオの削除
   - 該当レコードを削除（関連するアイテムもカスケード削除）
   →（処理終了）

</div>

---

## [API015] ポートフォリオ詳細取得

ポートフォリオの基本情報と、登録されている銘柄一覧を取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/portfolios/{portfolio_id}`
* **認証**: 必要

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | \&nbsp; |
| 2 | name | String | \&nbsp; |
| 3 | items | Array | 登録銘柄のリスト（Stock情報含む） |

</div>

**処理詳細**
<div class="api-logic">

1. ポートフォリオ情報の取得
   - `portfolios` テーブルから `id` で検索（所有権確認含む）
   - `portfolio_items` および `stocks` を結合して取得
   →項目名: 銘柄リストを含む詳細情報を返却（処理終了）

</div>

---

## [API016] ポートフォリオへの銘柄追加

ポートフォリオに特定の銘柄を追加します。

**基本情報**
* **Method**: POST
* **Path**: `/api/portfolios/{portfolio_id}/items`
* **認証**: 必要

**リクエストパラメータ**
<div class="api-request">

| No | 場所 | 項目名 | 型 | 必須 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Body | stock_id | Number | ○ | 追加する銘柄のID |
| 2 | Body | target_price | Number | - | 目標株価 |
| 3 | Body | notes | String | - | メモ |

</div>

**処理詳細**
<div class="api-logic">

1. 事前チェック
   - ポートフォリオの所有権を確認
   - 銘柄の存在を確認
   - 重複チェック（既に登録済みでないか）
2. 銘柄の追加
   - `portfolio_items` テーブルに新規レコードを挿入
   →項目名: 追加されたアイテム情報を返却（処理終了）

</div>

---

## [API017] ポートフォリオから銘柄削除

ポートフォリオ内の特定の銘柄を解除します。

**基本情報**
* **Method**: DELETE
* **Path**: `/api/portfolios/{portfolio_id}/items/{item_id}`
* **認証**: 必要

**処理詳細**
<div class="api-logic">

1. 事前チェック
   - ポートフォリオの所有権を確認
   - `portfolio_items.id` と `portfolio_id` の一致を確認
2. アイテムの解除
   - `portfolio_items` レコードを削除
   →（処理終了）

</div>

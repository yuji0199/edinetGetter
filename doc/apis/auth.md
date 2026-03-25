# 認証関連API

## [API001] ユーザー登録

新しいユーザーをシステムに登録します。

**基本情報**
* **Method**: POST
* **Path**: `/api/auth/register`
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
| 1 | Body | username | String | ○ | ユニーク制約 |
| 2 | Body | email | String | ○ | 形式：メールアドレス |
| 3 | Body | password | String | ○ | \&nbsp; |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | ユーザーID |
| 2 | username | String | \&nbsp; |
| 3 | email | String | \&nbsp; |

</div>

**処理詳細**
<div class="api-logic">

1. ユーザー重複チェック
   - `users.username` が既に存在するか確認する
   →存在する場合: エラー（400 Bad Request）を返却
2. パスワードハッシュ化
   - `utils.auth.get_password_hash` を使用
3. ユーザー情報の登録
   - `users` テーブルに新規レコードを挿入
   →項目名: `id`, `username`, `email` を返却（処理終了）

</div>

---

## [API002] ログイン

ユーザー認証を行い、JWTトークンを発行します。

**基本情報**
* **Method**: POST
* **Path**: `/api/auth/login`
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
| 1 | Body | username | String | ○ | ユーザー名 |
| 2 | Body | password | String | ○ | \&nbsp; |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | access_token | String | JWTトークン |
| 2 | token_type | String | 固定値: "bearer" |

</div>

**処理詳細**
<div class="api-logic">

1. ユーザー情報の取得
   - `users` テーブルから `username` に一致するレコードを取得
   →存在しない場合: エラー（401 Unauthorized）を返却
2. パスワード検証
   - `utils.auth.verify_password` を使用
   →一致しない場合: エラー（401 Unauthorized）を返却
3. JWTトークンの生成
   - `utils.auth.create_access_token` を使用
   →項目名: `access_token`, `token_type` を返却（処理終了）

</div>

---

## [API003] 現在のユーザー取得

トークンに基づき、ログイン中のユーザー情報を取得します。

**基本情報**
* **Method**: GET
* **Path**: `/api/auth/me`
* **認証**: 必要

**変更履歴**
<div class="log">

| No | 変更日 | 変更セクション | 変更項目 | 変更者 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-03-21 | 全体 | 新規作成 | yuji |

</div>

**レスポンス**
<div class="api-response">

| No | 項目名 | 型 | 備考 |
| :--- | :--- | :--- | :--- |
| 1 | id | Number | \&nbsp; |
| 2 | username | String | \&nbsp; |
| 3 | email | String | \&nbsp; |

</div>

**処理詳細**
<div class="api-logic">

1. トークン検証
   - HeaderのAuthorizationトークンを検証
   →不正な場合: エラー（401 Unauthorized）を返却
2. ユーザー情報の取得
   - トークンの `sub` クレームに基づき `users` レコードを取得
   →項目名: `id`, `username`, `email` を返却（処理終了）

</div>

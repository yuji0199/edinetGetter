# API設計書 (API Specifications)

本ドキュメントは、EDINETデータ分析アプリケーションのバックエンドAPIにおける設計・仕様をまとめたものです。

## 概要

本アプリケーションのバックエンドは FastAPI を使用して構築されており、認証、EDINETデータ同期、銘柄情報、分析手法、ポートフォリオ管理の各機能を提供します。

---

## API 一覧

### 認証関連

* [API001] [ユーザー登録](apis/auth.md#api001)
* [API002] [ログイン](apis/auth.md#api002)
* [API003] [現在のユーザー取得](apis/auth.md#api003)

### EDINETデータ関連

* [API004] [データ同期リクエスト](apis/edinet.md#api004)
* [API005] [最近の同期書類取得](apis/edinet.md#api005)

### 銘柄・財務データ関連

* [API006] [銘柄検索](apis/stocks.md#api006)
* [API007] [銘柄詳細・財務データ取得](apis/stocks.md#api007)
* [API018] [成長性分析データの取得](apis/stocks.md#api018)
* [API019] [銘柄検索 (Query)](apis/stocks.md#api019)

### 分析手法関連

* [API008] [分析手法一覧取得](apis/analysis.md#api008)
* [API009] [分析手法作成](apis/analysis.md#api009)
* [API010] [分析手法削除](apis/analysis.md#api010)
* [API011] [スクリーニング実行](apis/analysis.md#api011)

### ポートフォリオ関連

* [API012] [ポートフォリオ一覧取得](apis/portfolio.md#api012)
* [API013] [ポートフォリオ作成](apis/portfolio.md#api013)
* [API014] [ポートフォリオ削除](apis/portfolio.md#api014)
* [API015] [ポートフォリオ詳細取得](apis/portfolio.md#api015)
* [API016] [ポートフォリオへの銘柄追加](apis/portfolio.md#api016)
* [API017] [ポートフォリオから銘柄削除](apis/portfolio.md#api017)

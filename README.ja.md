# Create Tasks Redmine Plugin

AIを使用して最終目標を実行可能なタスクに分解するためのRedmineプラグインです。

## 機能

- **AIによるタスク分解**: AI（デフォルト: Gemini）を使用して、「最終成果物」という目標を具体的なタスクリストに分解します。
- **チケット登録権限ベースのアクセス**: プロジェクトでチケット登録権限（:add_issues）を持つユーザーがアクセス可能です。
- **プロジェクトメニュー統合**: 権限を持つユーザーはプロジェクトメニューから直接アクセスできます。

## 必要要件

- Redmine
- Node.js & npm (フロントエンドのビルド用)
- Docker (開発環境用・任意)

## インストール

1. **プラグインのクローン**
   Redmineのpluginsディレクトリに移動します:
   ```bash
   cd plugins/
   git clone <repository-url> create_tasks
   ```

2. **フロントエンド依存関係のインストール**
   フロントエンドディレクトリに移動します（開発用）:
   ```bash
   cd create_tasks/frontend
   npm install
   ```

3. **フロントエンドのビルド**
   フロントエンドアセットをコンパイルします:
   ```bash
   npm run build
   ```

4. **Redmineの再起動**
   変更を適用するためにRedmineを再起動します。
   Dockerを使用している場合:
   ```bash
   docker compose restart redmine
   ```

## 設定

**管理 > プラグイン > Create Tasks > 設定** に移動します。

利用可能な設定:
- **AIプロバイダー**: AIプロバイダーを選択します（デフォルト: `gemini`）。
- **トラッカーID**: 作成されるタスクに使用するトラッカーIDを指定します。
- **AIプロンプト**: タスク分解に使用されるシステムプロンプトをカスタマイズできます。

## ライセンス

MIT License

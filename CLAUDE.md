# airsoft-field-map — 進捗メモ

日本のサバゲーフィールド情報集約サイト。関東全域 + 各県主要3箇所、計62フィールド。

## 現在の状態（2026-04-18時点）

### ✅ 完了済み

**ローカル環境**
- Node.js 20.18.1 を `~/.local/node` にユーザーローカルインストール済み
  - 使用時は必ず `export PATH="$HOME/.local/node/bin:$PATH"` が必要
- Next.js 15.5.15 + TypeScript + TailwindCSS + MapLibre GL JS 構成で構築済み
- http://localhost:3000 で dev サーバー稼働確認済み（`npm run dev`）

**データ**
- `data/fields.json` に 62 フィールド登録済み（61 + サバゲーパラダイス追加）
  - スキーマ: id, name, prefecture, region, address, type, official_url, reservation_url, twitter_x, size_sqm, lat, lng, notes
- 全フィールドの緯度経度（Nominatim 経由）取得済み
  - フォールバック: 完全住所 → 建物名除去 → 都道府県+市 → 都道府県のみ
- 天気情報（Open-Meteo, 7日予報）全フィールド取得済み
- サバゲーパラダイスのみスケジュール + 中止情報を取得済み
  - Google Calendar iCal (`a861hpn5csrqhhavi47mfu92ao@group.calendar.google.com`) をパース
  - 今後の定例会10件 + 直近の中止2件

**機能**
- トップページ: 日本地図 + フィールドピン + フィルタ（地域・タイプ・検索）
- 詳細ページ `/field/[id]/`: 基本情報 / スケジュール / 中止情報 / 天気7日 / ニュース / 画像
- StatusBadge コンポーネント（scheduled/cancelled/full/unknown）
- DIVE風ダークテーマ（bg, panel, accent #c7f000, muted）

**スクリプト**
- `npm run dev` — ローカル開発
- `npm run build` — 静的エクスポート（`output: 'export'` 設定、`out/` 生成）
- `npm run geocode` — Nominatim で緯度経度取得
- `npm run update` — Claude API + Open-Meteo でスケジュール・天気を更新
- `npm run update:weather` — 天気のみ更新（Claude API 不使用）

**GitHub**
- リポジトリ: https://github.com/isseikikuchi-sys/airsoft-field-map
- push 済み（ただし `.github/workflows/update.yml` は PAT スコープ不足で除外中）
- 手動トリガー方式（cron 自動実行ではない）

**設定ファイル**
- `.claude/launch.json` — preview_start 用。直接 node バイナリパスを使用
- `.claude/run-dev.sh` — PATH を設定してから next dev を実行するシェル

### ⏸️ 停止中

**Cloudflare Pages デプロイ**
- 「Connect GitHub」の OAuth ループで止まっている
- GitHub 設定画面に戻されてリポジトリ選択画面に進めない

## 次にやること（優先度順）

### 1. Cloudflare Pages へのデプロイ完了（最優先）

**方法A: Direct Upload（OAuth ループを回避）**
```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd /Users/issei/Desktop/claude/DIVE_event/airsoft-field-map
npm run build
# → out/ ディレクトリが生成される
```
1. Cloudflare Dashboard → Workers & Pages → Create application
2. **Pages** タブ → **Upload assets**（Connect to Git ではない）
3. プロジェクト名: `airsoft-field-map`
4. `out/` フォルダをドラッグ&ドロップ
5. Deploy

**方法B: OAuth 再試行**
- 別ブラウザ or シークレットウィンドウで https://dash.cloudflare.com/ から再度 Connect to Git を試す
- GitHub 側の Cloudflare アプリ連携を一度 revoke してから再度承認

### 2. セキュリティ対応（完了済み）
- 初期PATは revoke 済み
- 新PAT（workflow scope付き）で push 可能

### 3. update スクリプトの改善（余裕があれば）
- Google Calendar の iframe を検出した場合、Claude API ではなく iCal feed を直接取得するロジックに切り替え
- コスト削減 + 取得精度向上

### 4. フィールドのスケジュール拡充
- サバゲーパラダイス以外のフィールドも順次、公式サイトからスケジュール取得
- `npm run update` を手動実行（API キー要設定）

### 5. カスタムドメイン設定
- Cloudflare Pages デプロイ後、独自ドメイン割当が必要なら DNS 設定

## 再開時のクイックスタート

```bash
# PATH 設定（毎回必要）
export PATH="$HOME/.local/node/bin:$PATH"

# 作業ディレクトリへ
cd /Users/issei/Desktop/claude/DIVE_event/airsoft-field-map

# ローカルサーバー起動
npm run dev
# → http://localhost:3000

# 本番ビルド
npm run build
# → out/ に静的ファイル生成
```

## 技術メモ（ハマりポイント）

- **Nominatim レート制限**: 1 req/sec 厳守。並列リクエスト禁止
- **3文字県名のregex**: `^(..[都道府県])` は神奈川県でマッチしない。`^(.{1,4}?[都道府県])` を使う
- **preview_start**: npm の shebang が PATH 解決できないため、直接 node バイナリ + next 本体を指定する
- **Next.js dev の --dir オプション**: サポートされていないので、ディレクトリは位置引数で渡す
- **GitHub PAT の workflow スコープ**: `.github/workflows/*.yml` を push するには `workflow` スコープが必要

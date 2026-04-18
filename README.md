# 全国サバゲーフィールドマップ

日本全国のサバゲーフィールドを地図・天気・直近スケジュールでまとめて確認できる Web サイト。

- **地図**: 全フィールドを日本地図にピン表示
- **詳細**: 名称/住所/広さ/系統/予約リンク
- **スケジュール**: 明日以降の定例会、直近の中止情報
- **天気**: 7日予報（Open-Meteo）
- **画像**: 公式サイト掲載画像
- **更新**: 手動実行（ローカルで `npm run update`、または GitHub Actions の「Run workflow」ボタン）

## 技術スタック

| 層 | 採用技術 |
|----|---------|
| サイト | Next.js 15 (App Router, 静的書き出し) |
| 地図 | MapLibre GL JS + OpenStreetMap タイル |
| 天気 | Open-Meteo API（APIキー不要） |
| スクレイピング | `fetch` + `cheerio` |
| ページ解釈 | Claude API (`claude-sonnet-4-6`) |
| ホスト | Cloudflare Pages |
| 自動化 | GitHub Actions (cron) |

## ディレクトリ

```
airsoft-field-map/
├── data/
│   ├── fields.json        # フィールドマスター（手動管理）
│   └── updates.json       # 毎朝自動生成（スケジュール/天気/画像）
├── scripts/
│   ├── geocode.ts         # 住所→緯度経度（初回・住所変更時のみ）
│   └── update.ts          # 毎朝の更新処理
├── src/
│   ├── app/               # Next.js ページ
│   ├── components/        # MapView, HomeView
│   └── lib/               # types, data loader
├── .github/workflows/
│   └── update.yml         # 06:30 JST cron
└── ...
```

## セットアップ（初回のみ）

### 1. 依存インストール

```bash
cd airsoft-field-map
npm install
```

### 2. Claude API キー取得

1. https://console.anthropic.com/ でアカウント作成・決済登録
2. **API Keys** → **Create Key** → `sk-ant-...` をコピー
3. ローカル用に `.env.local` を作成:

```bash
cp .env.example .env.local
# エディタで .env.local を開いて ANTHROPIC_API_KEY を貼り付け
```

### 3. フィールドリストの検証・補完

`data/fields.json` には AI が下書きしたリストが入っています。**URL や名称に誤りがある可能性があるため、公開前に手動で確認してください。**

- 実在しない URL を修正
- 抜けているフィールドを追加 / 重複を削除
- `reservation_url` や `twitter_x` を実際のページから埋める

### 4. ジオコーディング（座標付与）

住所から緯度経度を自動取得します（OpenStreetMap Nominatim、1秒1リクエスト）:

```bash
npm run geocode
```

完了後、地図上にピンが表示されるようになります。

### 5. 初回データ取得

```bash
npm run update
```

`data/updates.json` が生成されます（全フィールド分の天気・スケジュール等）。

### 6. ローカル確認

```bash
npm run dev
# → http://localhost:3000
```

## Cloudflare Pages へのデプロイ

### A. GitHub リポジトリを用意

```bash
cd airsoft-field-map
git init
git add .
git commit -m "initial commit"
gh repo create airsoft-field-map --public --source=. --push
# (private にしたい場合は --private)
```

### B. GitHub Actions Secrets 設定

リポジトリの **Settings → Secrets and variables → Actions → New repository secret**:

- `ANTHROPIC_API_KEY` = `sk-ant-...`

### C. Cloudflare Pages でプロジェクト作成

1. https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 対象リポジトリを選択
3. **Build settings**:
   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npm run build`
   - Build output directory: `out`
   - Node version: `20`
4. **Save and Deploy**

これで `git push` すると自動でデプロイされます。

### D. データ更新（手動）

**ローカルから:**
```bash
npm run update          # 全更新（スケジュール+画像+天気）
npm run update:weather  # 天気だけ（高速・低コスト）
```
更新後 `git add data/updates.json && git commit && git push` で反映。

**GitHub Actions から:**
リポジトリの **Actions → Manual Update → Run workflow** ボタンを押すだけ。
`full` か `weather-only` を選択 → 実行 → 自動で `updates.json` がcommitされる → Cloudflare Pages が再デプロイ。

## 運用コマンド

| 用途 | コマンド |
|------|---------|
| 開発サーバ | `npm run dev` |
| 本番ビルド | `npm run build` (出力: `out/`) |
| 手動でデータ更新 | `npm run update` |
| 天気だけ更新（高速） | `npm run update:weather` |
| 新フィールド追加後の座標付与 | `npm run geocode` |
| GitHub Actions を手動実行 | リポジトリの Actions タブ → Daily Update → Run workflow |

## コスト目安

- **Cloudflare Pages**: 無料（ビルド500回/月、帯域無制限）
- **Claude API**: 約150フィールド × 1回/日 × 30日 ≈ 月 $30〜60（Sonnet 4.6）
  - コスト削減したい場合は `CLAUDE_MODEL=claude-haiku-4-5-20251001` を設定（精度やや低下、1/5程度のコスト）
- **Open-Meteo**: 無料（商用利用も可）
- **OpenStreetMap / Nominatim**: 無料

## トラブルシューティング

### ピンが地図に出ない
→ `data/fields.json` の `lat/lng` が `null` です。`npm run geocode` を実行してください。

### スケジュールが空
→ 公式サイトが JavaScript 必須だと取得できません。その場合は `official_url` を「予約カレンダーページ」等の静的HTMLに変更してみてください。`fetch_error` は `updates.json` を確認。

### Cloudflare Pages のビルドで Node 20 に固定したい
→ リポジトリに `.nvmrc` を置くか、Pages の環境変数で `NODE_VERSION=20` を設定。

## ライセンス / クレジット

- 地図タイル: © OpenStreetMap contributors
- 天気: Open-Meteo

# スプレッドシート運用手順

フィールドのマスターデータは Google Sheets で管理し、毎朝 06:30 JST に自動で反映されます。

## 全体フロー

```
Google Sheets（あなたが編集）
    ↓ ①毎朝06:30 CSV公開URLから取得
scripts/sync-fields.ts
    ├─ 新規/住所変更行は Nominatim で自動ジオコーディング
    ├─ Drive共有URLをサムネURLに自動変換
    └─ data/fields.json を上書き
    ↓ ②天気・スケジュール更新
scripts/update.ts
    └─ data/updates.json を上書き
    ↓ ③commit → build → deploy
Cloudflare Workers 本番サイト
```

## 初期セットアップ（初回のみ）

### 1. Google Sheet を作る

1. https://sheets.google.com/ で新規スプレッドシート作成（名前例: `DIVE Field Master`）
2. リポジトリの [`data/fields_initial.csv`](../data/fields_initial.csv) をダウンロード
3. シートに **ファイル → インポート → アップロード** で CSV を読み込む
4. **区切り文字**: カンマ
5. **インポート場所**: 現在のシートを置換

これで 62 フィールドの初期データが入ります。

### 2. カラム定義

ヘッダー行（1行目）は以下の通り。**必須項目以外は空でOK**。

| 列 | 必須 | 内容 |
|---|---|---|
| `id` |   | 空欄なら `name` から自動生成。一度生成された id は変えない（URLが変わる） |
| `name` | ✓ | フィールド名 |
| `prefecture` | ✓ | 都道府県（例: 東京都、神奈川県） |
| `address` | ✓ | 完全な住所。**変更すると自動で再ジオコーディング** |
| `type` | ✓ | `インドア` / `アウトドア森林` / `アウトドア市街地（CQB）` / `混合` / `廃墟系` / `その他` |
| `official_url` | ✓ | 公式サイトTop URL |
| `events_url` |   | イベント/スケジュール専用ページ URL（空なら official_url を使用） |
| `reservation_url` |   | 予約ページ URL |
| `twitter_x` |   | X (Twitter) プロフィール URL |
| `size_sqm` |   | 広さ㎡（数値のみ、カンマ可） |
| `notes` |   | フィールドの特徴・コメント（1〜2行） |
| `gallery_urls` |   | ギャラリー画像 URL。**改行区切り or カンマ区切り**。Drive 共有URLは自動でサムネURLに変換 |

**自動補完**:
- `region`（関東/関西/九州...）は `prefecture` から自動判定
- `lat/lng` は address から Nominatim で自動取得（既存行は住所変更時のみ再取得）

### 3. CSV として公開

1. Google Sheets で **ファイル → 共有 → ウェブに公開**
2. **ドキュメント全体** を選択
3. **形式**: カンマ区切り形式 (.csv)
4. **公開** をクリック → 生成された URL をコピー
5. URL例: `https://docs.google.com/spreadsheets/d/e/XXXXXXX/pub?output=csv`

**注意**:
- 「ウェブに公開」は **閲覧専用のスナップショット** です。編集権限は付与されません。
- URLを知っていれば誰でもCSVを閲覧できます（ただし書き込みは不可）。
- フィールドの住所・URL は元々公開情報なので問題なし。

### 4. GitHub Secrets に登録

リポジトリの **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | 値 |
|---|---|
| `FIELDS_CSV_URL` | 手順3で生成されたCSV公開URL |
| `ANTHROPIC_API_KEY` | （既存）Claude API キー |
| `CLOUDFLARE_API_TOKEN` | （既存）デプロイ用 |
| `CLOUDFLARE_ACCOUNT_ID` | （既存）デプロイ用 |

## ギャラリー画像の登録方法

### A. Google Drive を使う場合（推奨）

1. Drive で画像をアップロード
2. 各画像を右クリック → **共有** → **リンクをコピー**
3. 共有設定を **「リンクを知っている全員」（閲覧者）** に変更
4. コピーしたURLを `gallery_urls` セルに貼り付け。複数枚は **改行で区切り**（`Alt + Enter` でセル内改行）

URL 例（このまま貼り付けでOK、自動で変換）:
```
https://drive.google.com/file/d/1abc...xyz/view?usp=sharing
https://drive.google.com/file/d/2def...xyz/view?usp=sharing
https://drive.google.com/file/d/3ghi...xyz/view?usp=sharing
```

### B. 任意の画像URLを使う場合

公式サイトの画像URLなど、直接リンクがあればそれをそのまま貼ればOK。
```
https://example.com/field/photo1.jpg
https://example.com/field/photo2.jpg
```

**注意**: 画像は一度登録すれば自動更新はされません（シート側が常に正）。差し替えたい場合は URL を書き直してください。

## 日常的な運用

### 新規フィールドを追加したい

1. シートに行を追加（name, prefecture, address, type, official_url は必須）
2. 保存するだけ。次の 06:30 JST の自動実行で:
   - Nominatim が住所をジオコーディング
   - フィールドが本番サイトに追加
   - イベント情報の自動取得開始

### 情報を修正したい

- 行を直接編集するだけ。次回の sync で反映。
- `address` を変更した場合は自動でジオコーディング再実行。
- `id` は変更しない（URLが変わってしまう）。

### 手動で今すぐ反映したい

リポジトリの **Actions → Daily Sync + Update + Deploy → Run workflow**:
- `full` (既定): sync + weather + schedule 全取得
- `weather-only`: 天気だけ更新（高速・低コスト）
- `sync-only`: シート同期のみ（新規追加の検証に便利）

### ローカルで検証したい

```bash
# 環境変数に CSV URL をセット
export FIELDS_CSV_URL="https://docs.google.com/spreadsheets/d/e/XXX/pub?output=csv"
export ANTHROPIC_API_KEY="sk-ant-..."

# シート同期
npm run sync

# 天気・スケジュール更新
npm run update

# ブラウザで確認
npm run dev  # → http://localhost:3000
```

## トラブルシューティング

| 症状 | 対応 |
|---|---|
| `unknown prefecture: XX` | 都道府県名が正しいか確認（例: `東京都` ○、`東京` ×） |
| `geocode MISS` | 住所の表記ゆれ。番地だけでなく市区町村まで含める |
| ギャラリー画像が表示されない | Drive共有が「リンクを知っている全員」になっているか確認 |
| シート更新が反映されない | CSV公開URLは反映まで数分ラグがあります。手動 workflow_dispatch で即反映可 |
| id の重複 | 自動で `-2`, `-3` が付加されるが、意図しない挙動なら手動で id を指定 |

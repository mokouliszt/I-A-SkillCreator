<div align="center">

<img src="docs/images/icon.png" width="120" alt="I-A-スキルクリエータ">

# I-A-スキルクリエータ

**会員限定のFAマニュアルサイトにログインし、Claudeが使えるSkillとして書き出すAndroidアプリ**

[English](README.md) · [日本語](README.ja.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-D97757.svg)](LICENSE)
![minSdk](https://img.shields.io/badge/minSdk-26-555)
![targetSdk](https://img.shields.io/badge/targetSdk-35-555)

</div>

---

三菱電機FA・オムロン・キーエンス・JTEKT のマニュアルは、多くが会員限定または
パスワード保護されています。そのためAIアシスタントに「このPLCの仕様を調べて」と
頼んでも、ログイン画面に弾かれて中身に到達できません。

このアプリは、**端末のWebViewで普通にログインしてもらい**、そこで得たセッションを
Claude Skill としてパッケージングします。書き出した `.skill` を Claude に読み込ませると、
Claude が会員限定PDFを直接読めるようになります。

<div align="center">

| サイト一覧 | 書き出し |
| :---: | :---: |
| <img src="docs/images/screenshot-sites.png" width="300" alt="サイト一覧"> | <img src="docs/images/screenshot-export.png" width="300" alt="書き出し"> |
| 取得済みCookieの件数と残り日数、<br>サイトごとの取得方式をバッジで表示 | 同梱するサイトを選び、<br>保存先を指定して `.skill` を書き出す |

</div>

## 何ができるか

- 4社のマニュアルを **製品を問わず** キーワード検索（PLCに限らずサーボ・インバータ・
  表示器・センサ・温度調節器など）
- 会員限定PDFの取得
- ID・パスワードをアプリに保存せず、セッションCookieだけを運ぶ

動作確認した製品の例:

| メーカー | 製品 | 種別 |
| --- | --- | --- |
| 三菱電機FA | MR-J5 / FR-A800 / GOT2000 | サーボ・インバータ・表示器 |
| オムロン | Sysmac Studio / NX / E5CC / E3Z | ソフト・PLC・温調・センサ |
| キーエンス | KV STUDIO / KV-8000 / IX / IV3 / SR-X | ソフト・PLC・変位センサ・画像センサ・コードリーダ |
| JTEKT | TOYOPUC 各種 | PLC・モーション |

## 対応サイト

| サイト | 方式 | 一覧・検索 | PDF取得 |
| --- | --- | --- | --- |
| 三菱電機FA（FAメンバーズ） | Cookie | ✅ | ✅ |
| オムロン（I-Webメンバーズ） | Cookie + JSON API | ✅ | ✅ |
| キーエンス | Cookie | ✅ | ✅ |
| JTEKT | 共有パスワード（要入力） | ✅ | ✅ |

各社サイトの作りが異なるため、Skill側は4通りの取得方法を持っています。

- **三菱** — 検索結果ページに会員限定PDFの直リンクが載る
- **オムロン** — 資料一覧がJS描画でHTMLに出ず、ヘッドレスブラウザもWAFに弾かれるため、
  ページ自身が使うJSON APIを直接叩く
- **キーエンス** — 一覧・ダウンロードともログインが必要。ダウンロードは確認画面を
  経由する3段の手順を踏む。セッションが短命なので書き出した直後に使う
- **JTEKT** — 共有パスワードで関門を通す。パスワードはリポジトリに含めず、
  アプリ上で一度入力してもらう方式です

## 使い方

1. アプリを起動し、各サイトの「ログイン」を押す
2. 開いたWebViewで**いつも通りログイン**し、右上の「完了」を押す
3. JTEKTのみ、カード内の欄に共有パスワードを入力して「保存」を押す
4. 「書き出す」タブでサイトを選び、保存先を指定して `.skill` を書き出す
5. 書き出した `.skill` を Claude に Skill として登録する

> **JTEKTの共有パスワードについて**
> JTEKTのマニュアルはパスワード1個の関門があります。パスワードはメーカーから
> 利用者へ案内されているものを各自で入力してください。本リポジトリおよびAPKには
> 含まれていません。入力した値は端末内のアプリ専用領域にのみ保存されます。

登録後は、Claudeに普通に質問するだけです。

```
GX Works3のRUN中書き込みの制限について、マニュアルで確認して
FR-A800のパラメータPr.7の設定範囲を教えて
```

### Skillの中身

```
industrial-auth-skill/
├── SKILL.md            # Claudeへの手順書
├── auth/
│   ├── mitsubishi.json # Cookie + User-Agent + 取得日時
│   ├── omron.json
│   ├── keyence.json
│   └── jtekt.pw.json   # 共有パスワード
└── scripts/
    ├── session.py      # セッション構築・失効検出
    └── fetch.py        # 検索・一覧・PDF取得
```

`fetch.py` の主なオプション:

```bash
# 全製品対象のキーワード検索
python scripts/fetch.py --site mitsubishi --search "FR-A800"

# PDF取得
python scripts/fetch.py --site omron --url "<PDF URL>" --out manual.pdf

# ページ内のリンク列挙
python scripts/fetch.py --site jtekt --links '\.pdf$' --url "<URL>"

# オムロン: 製品ファミリの資料一覧
python scripts/fetch.py --site omron --family 3077

# キーエンス: サポートページの資料カード
python scripts/fetch.py --site keyence --cards --url "<URL>"

# キーエンス: assetID を指定してPDF取得
python scripts/fetch.py --site keyence --asset AS_166466 --out kv8000.pdf
```

## セッションの寿命

`auth/*.json` の `expiresAt` は取得から30日を機械的に入れているだけで、
**実際の寿命はサイトごとに違います**。

- 三菱・オムロン — 数日〜数週間もつ
- **キーエンス — 実測で25分程度**。使う直前に取り直してから書き出してください

キーエンスは失効するとエラーではなく**空の一覧**が返ります。0件だったときは
製品が非対応なのではなく、まずセッション切れを疑ってください。

Skillが `AUTH_EXPIRED` を返したら、アプリで取り直して書き出し直してください。
Claudeが勝手にID・パスワードを尋ねることはありません（SKILL.mdで明示的に禁止しています）。

## ビルド

必要なもの: JDK 17以上、Node.js 20以上、Android SDK (compileSdk 35)

```bash
# 1) Web UI をビルドして assets に配置
cd web
npm install
npm run build
cp -r dist ../android/app/src/main/assets/www

# 2) APK をビルド
cd ../android
./gradlew assembleDebug
```

### リリースビルド

`android/keystore.properties` を作成してください（`.gitignore` 済み）。

```properties
storeFile=/path/to/your.keystore
storePassword=****
keyAlias=****
keyPassword=****
```

```bash
./gradlew assembleRelease
```

このファイルが無い場合、`assembleRelease` は無署名APKを生成します。

## 構成

WebView上のReactアプリと、薄いネイティブ層で構成されています。

```
web/                       Vite + React + Tailwind + shadcn/ui
android/app/src/main/
├── java/.../
│   ├── MainActivity.java  WebViewホスト + SAF連携
│   ├── AssetServer.java   仮想httpsオリジンでassetsを配信
│   ├── LoginActivity.java ログイン用WebView + Cookie回収
│   ├── FaBridge.java      JavaScriptInterface
│   ├── AuthStore.java     認証情報の保管（アプリ専用領域）
│   └── SkillBuilder.java  .skill の生成
└── assets/skill/          Skillのテンプレートとスクリプト
```

補足として、UIは `file://` ではなく `https://appassets.androidplatform.net/` から
配信しています。Viteが出力する ES モジュールは `file://` の不透明オリジンでは
CORSに阻まれて読み込めず、画面が真っ白になるためです。

## セキュリティ上の注意

- 書き出した `.skill` には**ログイン済みのセッションが入ります**。共有先に注意してください
- 認証情報は端末のアプリ専用領域（SharedPreferences）に保存されます。ID・パスワードは
  保存しません
- `.gitignore` で `*.skill` と `auth/*.json` を除外しています
- JTEKTの共有パスワードはソースに含めていません。利用者がアプリ上で入力し、
  端末内にのみ保存されます

## 免責

各サイトの利用規約に従ってご利用ください。本アプリは**利用者自身のアカウント**で
アクセスするためのものであり、認証の回避を目的としたものではありません。
取得したマニュアルの再配布はメーカーの権利を侵害する可能性があります。

サイト構造の変更により動作しなくなることがあります。

## ライセンス

[MIT](LICENSE)

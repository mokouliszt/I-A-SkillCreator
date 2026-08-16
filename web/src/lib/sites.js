export const SITES = [
  {
    id: "mitsubishi",
    name: "三菱電機FA",
    account: "FAメンバーズ",
    loginUrl:
      "https://www.mitsubishielectric.co.jp/fa/ssl/php/members/b_login.php?type=login",
    entryUrl:
      "https://www.mitsubishielectric.co.jp/fa/download/search.do?mode=keymanual&q=GX+Works3&lang=1",
    domains: ["www.mitsubishielectric.co.jp", "dl.mitsubishielectric.co.jp"],
    cookiePaths: ["/", "/fa/", "/fa/my/", "/dl/"],
    method: "フォームログイン",
    tier: "cookie",
    tierLabel: "Cookieのみで到達",
    detail:
      "一覧ページは公開。PDFは dl. 側で認証が要る。セッションCookieを保持すればそのまま取得できる。",
  },
  {
    id: "omron",
    name: "オムロン",
    account: "I-Webメンバーズ",
    loginUrl: "https://www.fa.omron.co.jp/view/login/index.cgi",
    entryUrl: "https://www.fa.omron.co.jp/download/manuals/",
    domains: ["www.fa.omron.co.jp"],
    cookiePaths: ["/", "/download/", "/products/", "/view/", "/product_api/"],
    method: "フォームログイン + JSON API",
    tier: "api",
    tierLabel: "APIを直接叩く",
    detail:
      "資料一覧はJS描画でHTMLに出ず、ヘッドレスもWAFに弾かれる。製品ファミリIDを指定して裏のJSON APIから一覧を取り、PDFは直URLで取得する。",
  },
  {
    id: "keyence",
    name: "キーエンス",
    account: "KVシリーズ ユーザー登録",
    loginUrl: "https://www.keyence.co.jp/mypage/",
    entryUrl:
      "https://www.keyence.co.jp/support/user/controls/plc/manual/building/",
    domains: ["www.keyence.co.jp"],
    // /mypage/ と /download/ は別webappで JSESSIONID が個別に発行される
    cookiePaths: ["/", "/download/", "/download/download/", "/mypage/", "/support/", "/user/"],
    method: "会員ログイン",
    tier: "cookie",
    tierLabel: "Cookieのみで到達",
    detail:
      "一覧・PDFともログインが必要。セッションが短命（実測25分程度）なので、書き出した直後に使うこと。全製品が /support/user/ 配下の同じURL規則で辿れる。",
  },
  {
    id: "jtekt",
    name: "JTEKT",
    account: "共有パスワード方式",
    loginUrl: "https://toyoda.jtekt.co.jp/support/OfcTpTorisetuList.php",
    entryUrl: "https://toyoda.jtekt.co.jp/support/OfcTpTorisetuList.php?gengo=1&searchBtn=%E6%A4%9C%E7%B4%A2",
    domains: ["toyoda.jtekt.co.jp"],
    method: "共有パスワード (authdata.php)",
    authEndpoint: "https://toyoda.jtekt.co.jp/authdata.php",
    tier: "password",
    tierLabel: "パスワードを入力",
    detail:
      "一覧は公開。PDFはパスワード1個の関門がある。ログインは不要だが、JTEKTから案内されている共有パスワードを一度だけ入力してください。",
  },
];

export const TIER = {
  cookie: { color: "#D97757", bg: "rgba(217,119,87,0.12)", label: "Cookie" },
  render: { color: "#C9A227", bg: "rgba(201,162,39,0.12)", label: "描画待ち" },
  password: { color: "#7FA968", bg: "rgba(127,169,104,0.14)", label: "共有PW" },
  api: { color: "#6FA8C7", bg: "rgba(111,168,199,0.14)", label: "API" },
};

export const T = {
  bg: "#191817",
  surface: "#232220",
  surface2: "#2C2B28",
  borderSoft: "#302E2B",
  text: "#F5F4EF",
  textDim: "#A5A29A",
  textFaint: "#75726B",
  accent: "#D97757",
  warn: "#C4703F",
  danger: "#B4553F",
};

export const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Globe,
  ChevronRight,
  Package,
  Loader2,
  RotateCw,
  Check,
  Trash2,
} from "lucide-react";
import { SITES, TIER, T, MONO } from "@/lib/sites";
import { Bridge, isNative } from "@/lib/bridge";

const DAY = 86400000;

function daysLeft(auth) {
  if (!auth?.expiresAt) return null;
  return Math.ceil((auth.expiresAt - Date.now()) / DAY);
}
function isExpired(auth) {
  const d = daysLeft(auth);
  return d !== null && d <= 0;
}

/**
 * Heuristic for "this cookie probably carries the login".
 * Patterns taken from what the four sites actually set:
 *   OTOI_USER_SESSIONID, JSESSIONID, iweb_ticket, user_id, session_info,
 *   authTokenId, signinStat, XSRF-TOKEN, PHPSESSID
 * Analytics/consent cookies (_ga, __utm*, Optanon, _uet*, _clck ...) are excluded.
 */
const AUTH_HINTS =
  /(sessionid|jsessionid|phpsessid|sessid|session|ticket|token|auth|signin|login|user_id|passport|sso|member)/i;
const NOISE = /^(_ga|_gid|_gcl|_fbp|_uet|_clck|_clsk|_tt|__utm|_vwo|_vis|_cq|_im_|_yjsu|_twpid|s_|AMCV|Optanon|RT$|AWSALB|deqwas|ttcsid|lnfea|visitor)/i;

function isAuthCookie(name) {
  if (!name) return false;
  if (NOISE.test(name)) return false;
  return AUTH_HINTS.test(name);
}

function authCookies(auth) {
  return (auth?.cookies || []).filter((c) => isAuthCookie(c.name));
}

function sortedCookies(auth) {
  return [...(auth?.cookies || [])].sort((a, b) => {
    const d = Number(isAuthCookie(b.name)) - Number(isAuthCookie(a.name));
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

function Chip({ children, color, bg, mono }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs"
      style={{
        color: color || T.textDim,
        backgroundColor: bg || T.surface2,
        fontFamily: mono ? MONO : undefined,
      }}
    >
      {children}
    </span>
  );
}

function StatusMark({ state }) {
  if (state === "ok") return <ShieldCheck size={16} style={{ color: T.accent }} />;
  if (state === "expired")
    return <ShieldAlert size={16} style={{ color: T.danger }} />;
  return <ShieldQuestion size={16} style={{ color: T.textFaint }} />;
}

function SiteCard({ site, auth, busy, onLogin, onOpen, onSavePassword }) {
  const tier = TIER[site.tier];
  const isPw = site.tier === "password";
  const hasPw = !!auth?.hasPassword;
  const expired = !isPw && auth && isExpired(auth);
  const state = isPw
    ? hasPw
      ? "ok"
      : "none"
    : auth
    ? expired
      ? "expired"
      : "ok"
    : "none";
  const left = daysLeft(auth);
  const [pwInput, setPwInput] = useState("");
  const [editing, setEditing] = useState(false);

  return (
    <Card className="overflow-hidden" style={{ backgroundColor: T.surface }}>
      <div className="flex">
        <div
          style={{
            width: 3,
            backgroundColor:
              state === "ok" ? T.accent : state === "expired" ? T.danger : T.borderSoft,
          }}
        />
        <CardContent className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusMark state={state} />
                <h3 className="truncate text-base font-medium" style={{ color: T.text }}>
                  {site.name}
                </h3>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: T.textFaint }}>
                {site.account}
              </p>
            </div>
            <Chip color={tier.color} bg={tier.bg}>
              {site.tierLabel}
            </Chip>
          </div>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: T.textDim }}>
            {site.detail}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {site.domains.map((d) => (
              <Chip key={d} mono>
                {d}
              </Chip>
            ))}
          </div>

          {isPw && (!hasPw || editing) && (
            <div
              className="mt-3 border-t pt-3"
              style={{ borderColor: T.borderSoft }}
            >
              <Label className="text-xs" style={{ color: T.textDim }}>
                共有パスワード
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  placeholder="配布されているパスワード"
                  className="h-9 flex-1 text-sm"
                  style={{ backgroundColor: T.surface2, color: T.text }}
                />
                <Button
                  size="sm"
                  disabled={!pwInput.trim()}
                  onClick={() => {
                    onSavePassword(site.id, pwInput.trim());
                    setPwInput("");
                    setEditing(false);
                  }}
                  className="h-9 px-4 text-xs font-medium"
                  style={{
                    backgroundColor: pwInput.trim() ? T.accent : T.surface2,
                    color: pwInput.trim() ? "#1B1A18" : T.textFaint,
                  }}
                >
                  保存
                </Button>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: T.textFaint }}>
                端末内にのみ保存されます。
              </p>
            </div>
          )}

          <div
            className="mt-3 flex items-center justify-between gap-2 border-t pt-3"
            style={{ borderColor: T.borderSoft }}
          >
            <span className="shrink-0 text-xs" style={{ color: T.textFaint }}>
              {isPw
                ? hasPw
                  ? "パスワード設定済み"
                  : "パスワード未設定"
                : auth
                ? expired
                  ? "期限切れ"
                  : `${auth.cookies?.length ?? 0}件 · 残り${left}日`
                : "未取得"}
            </span>

            {isPw ? (
              hasPw && !editing ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSavePassword(site.id, "")}
                    className="h-8 px-2 text-xs"
                    style={{ color: T.danger }}
                  >
                    削除
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="h-8 px-3 text-xs font-medium"
                    style={{ backgroundColor: T.surface2, color: T.text }}
                  >
                    <RotateCw size={13} className="mr-1" />
                    変更
                  </Button>
                </div>
              ) : (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: tier.color }}
                >
                  <ShieldQuestion size={13} />
                  入力が必要
                </span>
              )
            ) : (
              <div className="flex items-center gap-1">
                {auth && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpen(site)}
                    className="h-8 px-2 text-xs"
                    style={{ color: T.textDim }}
                  >
                    詳細
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => onLogin(site)}
                  disabled={busy}
                  className="h-8 px-3 text-xs font-medium"
                  style={{
                    backgroundColor: auth && !expired ? T.surface2 : T.accent,
                    color: auth && !expired ? T.text : "#1B1A18",
                  }}
                >
                  {busy ? (
                    <Loader2 size={13} className="mr-1 animate-spin" />
                  ) : auth ? (
                    <RotateCw size={13} className="mr-1" />
                  ) : (
                    <Globe size={13} className="mr-1" />
                  )}
                  {auth ? "取り直す" : "ログイン"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function App() {
  const [auths, setAuths] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [skillName, setSkillName] = useState("industrial-auth-skill");
  const [version, setVersion] = useState("0.1.0");
  const [selected, setSelected] = useState([]);
  const [exported, setExported] = useState(null);

  const refresh = useCallback(() => setAuths(Bridge.listAuth()), []);

  useEffect(() => {
    refresh();
    const onCaptured = () => {
      setBusyId(null);
      refresh();
    };
    const onExported = (e) => setExported(e.detail?.path || "");
    const onExportCancelled = () => setExported(null);
    window.addEventListener("faauth:captured", onCaptured);
    window.addEventListener("faauth:exported", onExported);
    window.addEventListener("faauth:export-cancelled", onExportCancelled);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setBusyId(null);
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("faauth:captured", onCaptured);
      window.removeEventListener("faauth:exported", onExported);
      window.removeEventListener("faauth:export-cancelled", onExportCancelled);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const usable = useMemo(
    () =>
      SITES.filter((s) =>
        s.tier === "password"
          ? !!auths[s.id]?.hasPassword
          : auths[s.id] && !isExpired(auths[s.id])
      ),
    [auths]
  );

  useEffect(() => {
    setSelected((sel) => sel.filter((id) => usable.some((s) => s.id === id)));
  }, [usable]);

  const login = (site) => {
    setBusyId(site.id);
    setExported(null);
    Bridge.openLogin(site.id, site.loginUrl, site.domains, site.cookiePaths);
  };

  const savePassword = (siteId, password) => {
    setExported(null);
    Bridge.setSharedPassword(siteId, password);
    setAuths(Bridge.listAuth());
  };

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const authFile = (id) => {
    const s = SITES.find((x) => x.id === id);
    return s.tier === "password" ? `${id}.pw.json` : `${id}.json`;
  };
  const tree = [
    `${skillName}.skill`,
    `└── ${skillName}/`,
    "    ├── SKILL.md",
    "    ├── auth/",
    ...selected.map(
      (id, i) =>
        `    │   ${i === selected.length - 1 ? "└──" : "├──"} ${authFile(id)}`
    ),
    "    └── scripts/",
    "        ├── session.py",
    "        └── fetch.py",
  ];

  const build = () => {
    setExported(null);
    Bridge.exportSkill({
      name: skillName,
      version,
      sites: selected.map((id) => {
        const s = SITES.find((x) => x.id === id);
        return {
          id: s.id,
          name: s.name,
          tier: s.tier,
          domains: s.domains,
          entryUrl: s.entryUrl,
          ...(s.tier === "password"
            ? { authEndpoint: s.authEndpoint }
            : {}),
        };
      }),
    });
  };

  return (
    <div className="min-h-full w-full pb-10" style={{ backgroundColor: T.bg }}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
        <header>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ backgroundColor: T.accent }}
            >
              <Package size={15} style={{ color: "#1B1A18" }} />
            </div>
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: T.text }}
            >
              I-A-スキルクリエータ
            </h1>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed" style={{ color: T.textDim }}>
            会員限定のFAマニュアルサイトにログインして認証情報を集め、Claudeが使えるSkillとして書き出します。
          </p>
        </header>

        <Tabs defaultValue="sites" className="mt-7">
          <TabsList
            className="grid w-full grid-cols-2 gap-1 rounded-xl p-1"
            style={{ backgroundColor: T.surface }}
          >
            <TabsTrigger value="sites" className="rounded-lg text-sm">
              サイト
            </TabsTrigger>
            <TabsTrigger value="build" className="rounded-lg text-sm">
              書き出す
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="mt-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs" style={{ color: T.textFaint }}>
                {usable.length} / {SITES.length} サイト利用可能
              </span>
              <div className="flex items-center gap-3">
                {Object.entries(TIER).map(([k, v]) => (
                  <span
                    key={k}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: T.textFaint }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            {SITES.map((s) => (
              <SiteCard
                key={s.id}
                site={s}
                auth={auths[s.id]}
                busy={busyId === s.id}
                onLogin={login}
                onOpen={setDetail}
                onSavePassword={savePassword}
              />
            ))}
          </TabsContent>

          <TabsContent value="build" className="mt-4 space-y-4">
            <Card style={{ backgroundColor: T.surface }}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs" style={{ color: T.textDim }}>
                      Skill名
                    </Label>
                    <Input
                      value={skillName}
                      onChange={(e) =>
                        setSkillName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))
                      }
                      className="h-9 text-sm"
                      style={{
                        backgroundColor: T.surface2,
                        color: T.text,
                        fontFamily: MONO,
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" style={{ color: T.textDim }}>
                      バージョン
                    </Label>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="h-9 text-sm"
                      style={{
                        backgroundColor: T.surface2,
                        color: T.text,
                        fontFamily: MONO,
                      }}
                    />
                  </div>
                </div>

                <Separator style={{ backgroundColor: T.borderSoft }} />

                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: T.textDim }}>
                    同梱するサイト
                  </Label>
                  {SITES.map((s) => {
                    const ok =
                      s.tier === "password"
                        ? !!auths[s.id]?.hasPassword
                        : auths[s.id] && !isExpired(auths[s.id]);
                    return (
                      <button
                        key={s.id}
                        onClick={() => ok && toggle(s.id)}
                        disabled={!ok}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                        style={{
                          backgroundColor: T.surface2,
                          opacity: ok ? 1 : 0.4,
                        }}
                      >
                        <Checkbox
                          checked={selected.includes(s.id)}
                          disabled={!ok}
                          className="pointer-events-none"
                        />
                        <span className="flex-1 text-sm" style={{ color: T.text }}>
                          {s.name}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: T.textFaint, fontFamily: MONO }}
                        >
                          {s.tier === "password"
                            ? ok
                              ? "PW設定済み"
                              : "PW未設定"
                            : ok
                            ? `${s.id}.json`
                            : "未取得"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: T.surface }}>
              <CardContent>
                <Label className="text-xs" style={{ color: T.textDim }}>
                  書き出される中身
                </Label>
                <pre
                  className="mt-2.5 overflow-x-auto text-xs leading-relaxed"
                  style={{ color: T.textDim, fontFamily: MONO }}
                >
                  {selected.length
                    ? tree.join("\n")
                    : "サイトを1つ以上選んでください"}
                </pre>
              </CardContent>
            </Card>

            <Button
              disabled={!selected.length}
              onClick={build}
              className="h-11 w-full text-sm font-medium"
              style={{
                backgroundColor: selected.length ? T.accent : T.surface2,
                color: selected.length ? "#1B1A18" : T.textFaint,
              }}
            >
              {exported ? (
                <>
                  <Check size={15} className="mr-1.5" />
                  保存しました
                </>
              ) : (
                <>
                  保存先を選んで書き出す
                  <ChevronRight size={15} className="ml-1" />
                </>
              )}
            </Button>

            <p className="px-1 text-xs leading-relaxed" style={{ color: T.textFaint }}>
              {exported
                ? `${exported} を保存しました`
                : "保存先を選ぶと .skill ファイルを書き出します。ログイン済みのセッションが入るので、保存先に注意してください。"}
            </p>
          </TabsContent>
        </Tabs>

        {!isNative && (
          <p className="mt-6 text-center text-xs" style={{ color: T.textFaint }}>
            ブラウザプレビュー（ダミーデータ）
          </p>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent style={{ backgroundColor: T.surface, color: T.text }}>
          <DialogHeader>
            <DialogTitle className="text-base">{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs" style={{ color: T.textFaint }}>
                    認証方式
                  </p>
                  <p className="text-sm" style={{ color: T.textDim }}>
                    {detail.method}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs" style={{ color: T.textFaint }}>
                    取得日時
                  </p>
                  <p className="text-sm" style={{ color: T.textDim }}>
                    {auths[detail.id]?.capturedAt
                      ? new Date(auths[detail.id].capturedAt).toLocaleString(
                          "ja-JP",
                          { dateStyle: "short", timeStyle: "short" }
                        )
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs" style={{ color: T.textFaint }}>
                    取得済みCookie
                  </p>
                  <p className="text-xs" style={{ color: T.textFaint }}>
                    認証系 {authCookies(auths[detail.id]).length} /{" "}
                    {(auths[detail.id]?.cookies || []).length} 件
                  </p>
                </div>

                {authCookies(auths[detail.id]).length === 0 && (
                  <p className="text-xs" style={{ color: T.danger }}>
                    認証に使われそうなCookieが見つかりません。ログインが完了していない可能性があります。
                  </p>
                )}

                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {sortedCookies(auths[detail.id]).map((c, i) => {
                    const isAuth = isAuthCookie(c.name);
                    return (
                      <div
                        key={`${c.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
                        style={{
                          backgroundColor: T.surface2,
                          opacity: isAuth ? 1 : 0.55,
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-xs"
                            style={{
                              color: isAuth ? T.accent : T.text,
                              fontFamily: MONO,
                            }}
                          >
                            {c.name}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{ color: T.textFaint, fontFamily: MONO }}
                          >
                            {c.domain}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-xs"
                          style={{ color: T.textFaint, fontFamily: MONO }}
                        >
                          ••••••
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: T.textFaint }}>
                  オレンジが認証に関係しそうなCookie。値は表示しません。
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs" style={{ color: T.textFaint }}>
                  User-Agent
                </p>
                <p
                  className="break-all text-xs"
                  style={{ color: T.textDim, fontFamily: MONO }}
                >
                  {auths[detail.id]?.userAgent || "-"}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  Bridge.clearAuth(detail.id);
                  setDetail(null);
                  setAuths(Bridge.listAuth());
                }}
                className="h-9 w-full text-xs"
                style={{ color: T.danger, backgroundColor: T.surface2 }}
              >
                <Trash2 size={13} className="mr-1.5" />
                この認証情報を削除
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

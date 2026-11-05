// ひかり道の検査。部屋の作り方（いちばん少ない鏡の数を、別に書いた光のたどり方と全部の置き方で数え直す）・3問の組み方（1年分）・置く/回す/戻す/ヒント・続きから・上級・部屋帳・実績・記録・スマホ幅・PWA。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const T = createRequire(import.meta.url)(path.join(root, "gen.js"));
const LVS = [...T.SIZES, T.HARD];

// 別に書いた光のたどり方（gen.js の trace を使わない）。鏡「／」は右↔上・左↔下、「＼」は右↔下・左↔上を入れかえる
const STEP = { E: [0, 1], W: [0, -1], S: [1, 0], N: [-1, 0] };
const REFL = { 1: { E: "N", N: "E", W: "S", S: "W" }, 2: { E: "S", S: "E", W: "N", N: "W" } };
const DNAME = ["E", "S", "W", "N"];
function walk(p, put) {
  let r = p.lr, c = 0, d = "E"; const seen = new Set(), gems = new Set(), cells = new Set();
  while (true) {
    if (r < 0 || c < 0 || r >= p.H || c >= p.W) { const [dr, dc] = STEP[d]; return { ok: r - dr === p.goal.r && c - dc === p.goal.c && d === DNAME[p.goal.d], gems, cells }; }
    const k = `${r},${c},${d}`; if (seen.has(k)) return { ok: false, gems, cells }; seen.add(k); cells.add(r * p.W + c);
    const v = p.cell[r][c];
    if (v === 1) return { ok: false, gems, cells };
    if (v === 2) gems.add(r * p.W + c);
    const m = v === 3 ? 1 : v === 4 ? 2 : put ? put[r][c] : 0;
    if (m) d = REFL[m][d];
    const [dr, dc] = STEP[d]; r += dr; c += dc;
  }
}
const goes = (p, put) => { const w = walk(p, put); return w.ok && w.gems.size === p.gems.length; };
// 鏡を k 枚以下にした置き方を全部試して、届く置き方があるか
function anyWith(p, k) {
  const free = []; p.cell.forEach((row, r) => row.forEach((v, c) => { if (v === 0) free.push([r, c]); }));
  const put = p.cell.map((row) => row.map(() => 0));
  const rec = (start, left) => {
    if (goes(p, put)) return true;
    if (!left) return false;
    for (let j = start; j < free.length; j++) { const [r, c] = free[j]; for (const m of [1, 2]) { put[r][c] = m; if (rec(j + 1, left - 1)) return true; } put[r][c] = 0; }
    return false;
  };
  return rec(0, k);
}
// 1. 部屋の作り方（ブラウザを使わない）
{
  const bad = [], solBad = [], brute = [], hintBad = [], same = [], dist = {};
  LVS.forEach((L, lv) => {
    const N = lv === 3 ? 150 : 400;
    for (let s = 0; s < N; s++) {
      const seed = T.seedOf(`qa:${lv}:${s}`), p = T.make(seed, L);
      if (!p) { bad.push(`${L.name}:${s}:作れない`); continue; }
      const flat = p.cell.flat(), cnt = (v) => flat.filter((x) => x === v).length;
      const onEdge = (p.goal.d === 0 && p.goal.c === p.W - 1) || (p.goal.d === 2 && p.goal.c === 0) || (p.goal.d === 1 && p.goal.r === p.H - 1) || (p.goal.d === 3 && p.goal.r === 0);
      if (p.W !== L.W || p.H !== L.H || cnt(2) !== L.gem || p.gems.length !== L.gem || cnt(1) !== L.rock || cnt(3) + cnt(4) !== L.fix || !onEdge || p.d < L.min[0] || p.d > L.min[1] || p.cell[p.lr][0] === 1) bad.push(`${L.name}:${s}`);
      // 答えの置き方：空いたますだけ・ちょうど d 枚・別のたどり方でも届く
      if (!p.sol || T.count(p.sol) !== p.d || p.sol.some((row, r) => row.some((v, c) => v && p.cell[r][c] !== 0)) || !goes(p, p.sol)) solBad.push(`${L.name}:${s}`);
      // 小部屋・広間は、d−1 枚以下の置き方を全部試しても届かない（いちばん少ないのが d 枚）
      if ((lv === 0 && s < 200) || (lv === 1 && s < 60)) { if (anyWith(p, p.d - 1)) brute.push(`${L.name}:${s}:${p.d}`); }
      // ヒント：答えの鏡を1枚動かさなくしても、残りはちょうど d−1 枚
      if (s < 60) { const fx = p.sol.map((row) => row.map(() => 0)); outer: for (let r = 0; r < p.H; r++) for (let c = 0; c < p.W; c++) if (p.sol[r][c]) { fx[r][c] = p.sol[r][c]; break outer; } const h = T.solve(p, fx, 20); if (!h || h.d !== p.d - 1 || !goes(p, h.put)) hintBad.push(`${L.name}:${s}`); }
      // ヒントで答えの鏡を全部動かさなくしたら、残りは0枚（動かせない鏡を下限に数えない。2026-11-05 CodeRabbit）
      if (s < 40) { const h = T.solve(p, p.sol, 20); if (!h || h.d !== 0) hintBad.push(`${L.name}:${s}:全部`); }
      if (s < 30 && JSON.stringify(T.make(seed, L)) !== JSON.stringify(p)) same.push(`${L.name}:${s}`);
      dist[L.name] = dist[L.name] || {}; dist[L.name][p.d] = (dist[L.name][p.d] || 0) + 1;
    }
  });
  check("部屋は大きさ・宝石・岩・はじめからの鏡の数が決まりどおり、出口は外側、いちばん少ない鏡の数は決めた幅（3つの大きさ400部屋、上級150部屋）", bad.length === 0, bad.slice(0, 3).join(","));
  check("答えの置き方は空いたますだけ・ちょうどその枚数で、別に書いた光のたどり方でも宝石を全部通って出口へ届く", solBad.length === 0, solBad.slice(0, 3).join(","));
  check("小部屋（200部屋）と広間（60部屋）は、1枚少ない置き方を全部試しても届かない（いちばん少ない数が正しい）", brute.length === 0, brute.slice(0, 3).join(","));
  check("ヒントで鏡を1枚動かさなくしても、残りのいちばん少ない数はちょうど1枚減る", hintBad.length === 0, hintBad.slice(0, 3).join(","));
  check("同じ種からは同じ部屋になる（だれでも同じ問題）", same.length === 0, same.join(","));
  check("いちばん少ない鏡の数がばらける（同じ数ばかりにならない）", Object.values(dist).every((d) => Object.keys(d).length >= 2), JSON.stringify(dist));
  { // 鏡は表と裏の両方で光を曲げる（同じ鏡に2回当たる道もいちばん少ない数に入る。2026-11-05 作るときに数えちがえた）
    const p = { W: 3, H: 3, lr: 1, cell: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], gems: [], goal: { r: 1, c: 2, d: 0 } };
    const put = [[0, 0, 0], [0, 0, 1], [0, 0, 0]];
    check("光の向きの見本：「／」に右から当たると上へ、「＼」だと下へ曲がる", T.turn(0, 1) === 3 && T.turn(0, 2) === 1 && T.turn(3, 1) === 0 && T.turn(1, 2) === 0 && !T.solved(p, put)); }
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("別のタブで先に進んだ（同じ回数の）置き方を、古いタブの置き方で上書きしない（2026-11-04・11-05 CodeRabbit）", /!\(old && old\.moves >= cur\.moves\)\)/.test(html));
{ // ひな形を写したリポジトリで、README・AGENTS.md に前のゲームの名前や URL が残らない（2026-11-05 CodeRabbit）
  const docs = ["README.md", "AGENTS.md", "manifest.webmanifest", "sw.js", "index.html"].map((f) => [f, readFileSync(path.join(root, f), "utf8")]);
  const left = docs.filter(([, t]) => /あみだ|amida|配達|しりとり|shiritori|ことばならべ|kotoba|words\.js|言葉帳|github\.io\/(?!hikari-michi\/)[a-z0-9-]+\//.test(t)).map(([f]) => f);
  check("README・AGENTS.md・manifest・sw.js・画面はこのゲームの名前と URL だけ（写し元のゲームが残らない）", left.length === 0 && /^# ひかり道/.test(docs[0][1]) && /satou-aaaaa\.github\.io\/hikari-michi\//.test(docs[0][1]), left.join(",")); }
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の問題の種だけ（今日の3問・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 1 && /mode === "h" \? hardList\(k\) : \[\{ lv: opt, seed: Math\.floor\(Math\.random\(\)/.test(html) && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/hikari-michi/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）・フォーム名は4字以上（3字以下だと GitHub がフォームを出さない。2026-11-05 CodeRabbit）", [...((fy.match(/^name: (.+)$/m) || [])[1] || "")].length > 3 && /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];
  const local = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => "./" + m[1]);
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*wait\(15000\)[^\n]*wait\(60000\)\]\)\)/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し（画面が読むスクリプトも全部）、外へ何も送らない", need.concat(local).every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：保存が無く通信も返らなくても、60秒で必ず返事をする", /setTimeout\(\(\) => fromCache\(\)\.then\(\(hit\) => send\(hit \|\| Response\.error\(\)\)\), 60000\)/.test(sw));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "ひかり道" && mf.icons.length >= 2 && mf.start_url === "./");
  check("PWA：maskable のアイコンは絵を縮めた別の画像（丸く切られても欠けない。2026-11-05 CodeRabbit）", mf.icons.some((i) => i.purpose === "maskable" && i.src === "icon-512-maskable.png") && !mf.icons.some((i) => i.purpose === "maskable" && i.src === "icon-512.png")); }
{ // ホームの見本とアイコン：下向きの光を右へ曲げる鏡は「＼」（左上→右下の線）。2026-11-05 逆向きで描いていた（CodeRabbit）
  const ic = readFileSync(path.join(root, "tools/make-icons.cjs"), "utf8");
  check("ホームの見本とアイコンの鏡の向きが光の曲がり方と合う（下→右は「＼」）", /<line x1="97" y1="79" x2="123" y2="105"\/>/.test(html) && /<line x1="52" y1="64" x2="72" y2="84"\/>/.test(ic)); }
{ const src = html + readFileSync(path.join(root, "gen.js"), "utf8");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }

let browser = null; // 起動に失敗しても report.md を書けるように、起動は下の try の中で
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
const FIXED = new Date(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + "T03:00:00Z");
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(FIXED); // 時計を今日の昼（日本時間）に止める。QA の途中で0時をまたいでも「今日」が変わらない
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curT = (page) => page.evaluate(() => { const c = window.__hk.cur(); return { p: c.p, put: c.put.map((x) => x.slice()), hint: c.hint.map((x) => x.slice()), hints: c.hints, moves: c.moves, done: c.done, hard: c.hard }; });
const cellSel = (r, c) => `#board rect.hit[data-r="${r}"][data-c="${c}"]`;
const nPut = (put) => put.flat().filter(Boolean).length;
// 鏡を置ける空いたます（光の道の外を先に）
async function freeCell(page) {
  const c = await curT(page), p = c.p, on = walk(p, c.put).cells;
  for (const off of [true, false]) for (let r = 0; r < p.H; r++) for (let k = 0; k < p.W; k++) if (p.cell[r][k] === 0 && !c.put[r][k] && (!off || !on.has(r * p.W + k))) return [r, k];
}
// ヒントの鏡を残して、いちばん少ない置き方に置き直して届ける
async function solveNow(page) {
  if (await page.locator("#clear:not([disabled])").count()) await page.click("#clear");
  const c = await curT(page), p = c.p, fixed = p.cell.map((row) => row.map(() => 0));
  c.hint.forEach(([r, k]) => { fixed[r][k] = c.put[r][k]; });
  const s = T.solve(p, fixed, 20);
  for (let r = 0; r < p.H; r++) for (let k = 0; k < p.W; k++) if (s.put[r][k] && !fixed[r][k]) for (let j = 0; j < s.put[r][k]; j++) await page.click(cellSel(r, k));
  await page.click("#answer");
}
const KEY = "hikari-michi-v1";
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await newPage();
  // 2. 3問の組み方（日付の種）
  const sel = await page.evaluate(() => {
    const g = window.__hk, out = { bad: [], same: 0, hsame: 0 };
    let prev = null;
    for (let n = 0; n < 365; n++) {
      const k = new Date(Date.parse("2026-11-05") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k).map(g.probOf), h = g.hardList(k).map(g.probOf);
      if (d.some((p) => !p) || h.some((p) => !p) || d.map((p) => `${p.W}x${p.H}`).join() !== "5x5,6x6,6x7" || h.map((p) => `${p.W}x${p.H}`).join() !== "6x8,6x8") { out.bad.push(k); continue; }
      const sig = d.map((p) => JSON.stringify([p.cell, p.lr, p.goal]));
      if (prev && sig.some((x) => prev.includes(x))) out.same++; prev = sig;
      if (JSON.stringify(h[0].cell) === JSON.stringify(h[1].cell)) out.hsame++;
    }
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01").map(g.probOf));
    return out;
  });
  check("今日の3問は毎日5×5・6×6・6×7、上級は6×8を2つ（1年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("前の日と同じ部屋が出ない・上級の2つは別の部屋（1年分）", sel.same === 0 && sel.hsame === 0);
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => { const g = window.__hk; return JSON.stringify(g.dailyList("2026-12-01").map(g.probOf)); });
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3問", sel.d1201 === d2); }

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  await page.click("#go-d");
  let c = await curT(page);
  check("1問目は5×5の部屋：押す所25・宝石・明かり・出口が出て、届けるボタンは押せない・いちばん少ない鏡の数が出る", (await page.locator("#board rect.hit").count()) === 25 && (await page.locator("#board .gem").count()) === c.p.gems.length && (await page.locator("#board .lamp").count()) === 1 && (await page.locator("#board .goal").count()) === 1 && (await page.locator("#answer[disabled]").count()) === 1 && (await page.textContent("#ask")).includes(`${c.p.d}枚`));
  const f1 = await freeCell(page);
  await page.click(cellSel(...f1));
  let n1 = await curT(page);
  check("空いたますを押すと鏡「／」が置ける", n1.put[f1[0]][f1[1]] === 1 && (await page.locator("#board .mirror").count()) === 1 && (await page.textContent("#left")).includes("鏡 1枚"));
  await page.click(cellSel(...f1));
  n1 = await curT(page);
  check("もう一度押すと「＼」、もう一度でなくなる", n1.put[f1[0]][f1[1]] === 2 && (await page.click(cellSel(...f1)), (await curT(page)).put[f1[0]][f1[1]] === 0) && (await page.locator("#board .mirror").count()) === 0);
  await page.click(cellSel(...f1));
  await page.click("#undo");
  check("ひとつ戻すと、置いた鏡がもとに戻る", nPut((await curT(page)).put) === 0);
  { // 岩・宝石には置けない
    const p = c.p; let rock = null, gem = null;
    for (let r = 0; r < p.H; r++) for (let k = 0; k < p.W; k++) { if (!rock && p.cell[r][k] === 1) rock = [r, k]; if (!gem && p.cell[r][k] === 2) gem = [r, k]; }
    await page.click(cellSel(...rock)); await page.click(cellSel(...gem));
    check("岩と宝石のますには鏡を置けない", nPut((await curT(page)).put) === 0); }
  { // 光の筋：鏡が無いときは左から右へまっすぐ（岩で止まるか外へ出る）
    const pts = await page.getAttribute("#board .beam", "points");
    check("光の筋が明かりから出ている", pts && pts.split(" ").length >= 2); }
  await page.click("#hint");
  n1 = await curT(page);
  { const fx = c.p.cell.map((row) => row.map(() => 0)); if (n1.hint[0]) fx[n1.hint[0][0]][n1.hint[0][1]] = n1.put[n1.hint[0][0]][n1.hint[0][1]];
    const h = T.solve(c.p, fx, 20);
    check("ヒント1回目で、いちばん少ない置き方の鏡が1枚（金色）置かれ、残りは1枚少なくなる", n1.hints === 1 && n1.hint.length === 1 && nPut(n1.put) === 1 && h && h.d === c.p.d - 1); }
  await page.click(cellSel(...n1.hint[0]));
  check("ヒントの鏡は押しても動かない", JSON.stringify((await curT(page)).put) === JSON.stringify(n1.put));
  await page.click("#hint");
  n1 = await curT(page);
  check("ヒント2回目でもう1枚、ヒントはもう押せない", n1.hints === 2 && n1.hint.length === 2 && (await page.locator("#hint[disabled]").count()) === 1);
  await page.reload(); await page.click("#go-d");
  n1 = await curT(page);
  check("途中で閉じても、置いた鏡・ヒントはそのまま（続きから）", n1.hints === 2 && n1.hint.length === 2 && nPut(n1.put) === 2 && (await page.textContent("#left")).includes("ヒント 2"));
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", (await curT(page)).hints === 2 && (await page.evaluate(() => window.__hk.mode())) === "d");
  await solveNow(page);
  n1 = await curT(page);
  check("宝石を全部通って出口に届くと届けられ、ヒント2回でいちばん少ない数なら★1", n1.done && (await page.locator(".verdict .stars .off").textContent()).length === 2 && (await page.locator("#board.win").count()) === 1 && (await page.locator("#board .goal.ok").count()) === 1 && (await page.locator("#board .gem.lit").count()) === c.p.gems.length);
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の答えは足さない
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 0, h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await solveNow(page);
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の問題を出し直す", (await page.evaluate(() => window.__hk.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  { const c2 = await curT(page);
    let fixedCell = null; for (let r = 0; r < c2.p.H && !fixedCell; r++) for (let k = 0; k < c2.p.W; k++) if (c2.p.cell[r][k] >= 3) { fixedCell = [r, k]; break; }
    if (fixedCell) await page.click(cellSel(...fixedCell));
    check("2問目は6×6の部屋で、はじめからの鏡（押しても動かない）がある・届くまで届けるボタンは押せない", c2.p.W === 6 && c2.p.H === 6 && !!fixedCell && (await page.locator("#board .fixed").count()) === 1 && nPut((await curT(page)).put) === 0 && (await page.locator("#answer[disabled]").count()) === 1);
    await solveNow(page); await page.click("#next");
    await solveNow(page); await page.click("#next"); }
  const share = await page.textContent(".share");
  const r3 = await page.evaluate(() => { const g = window.__hk; return g.load().days[g.todayKey()].r; });
  check("3問で結果・シェアの文は番号と色だけ", /ひかり道 #\d+/.test(share) && /^💡🟩🟩/.test(share.split("\n")[1] || "") && r3.length === 3 && r3[0].m === 0 && r3[0].h === 2);
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3つの部屋と鏡の数が出る", (await page.locator(".res div").count()) === 3 && (await page.textContent(".res")).includes(`いちばん少ないと${c.p.d}枚`));
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  check("今日の3問を終えると、取れた実績が結果に出る", (await page.textContent(".newach")).includes("はじめての光"));
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・通した部屋3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3通した部屋") && (await page.textContent("#go-d")).includes("結果"));
  // 上級
  await page.click("#go-h");
  check("上級は6×8の部屋・ヒントのボタンが無い", (await page.locator("#board rect.hit").count()) === 48 && (await page.locator("#hint").count()) === 0);
  await solveNow(page); await page.click("#next");
  check("上級の2つ目も6×8の部屋", (await page.locator("#board rect.hit").count()) === 48);
  await solveNow(page); await page.click("#next");
  check("上級を全部いちばん少ない鏡で初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("いちばん少ない"));
  check("上級を2つともぴったりで終えると、実績「上級に挑む」「上級の鏡師」が出る", /上級に挑む/.test(await page.textContent(".newach")) && /上級の鏡師/.test(await page.textContent(".newach")));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：光の通らないますに余分な鏡を2枚置いて★2
  // 練習の部屋は乱数なので、検査では「光の通らない空いたますが2つ以上」ある種を先に選んで練習の回に入れる（検査の期待値を乱数に頼らない）
  const offOf = (p) => { const on = walk(p, p.sol).cells, out = []; for (let r = 0; r < p.H; r++) for (let k = 0; k < p.W; k++) if (p.cell[r][k] === 0 && !p.sol[r][k] && !on.has(r * p.W + k)) out.push([r, k]); return out.length >= 2 ? out.slice(0, 2) : null; };
  let pseed = 1; while (!offOf(T.make(pseed, T.SIZES[0]))) pseed++;
  await page.evaluate(([k, seed]) => { const s = JSON.parse(localStorage.getItem(k)), d = window.__hk.todayKey(); s.runs.p = { mode: "p", date: d, list: [{ lv: 0, seed }], res: [], cur: null, id: "qa" }; localStorage.setItem(k, JSON.stringify(s)); window.__hk.play("p"); }, [KEY, pseed]);
  { const p = (await curT(page)).p, off = offOf(p);
    for (const [r, k] of off) await page.click(cellSel(r, k));
    for (let r = 0; r < p.H; r++) for (let k = 0; k < p.W; k++) for (let j = 0; j < p.sol[r][k]; j++) await page.click(cellSel(r, k));
    await page.click("#answer");
    check("いちばん少ない数より2枚多く置いて届けると★2（練習）", (await curT(page)).done && (await page.locator(".verdict .stars .off").textContent()).length === 1 && (await page.textContent(".verdict")).includes(`いちばん少ないと${p.d}枚`), JSON.stringify(off));
    await page.click("#next"); }
  const after = await page.evaluate(() => { const s = window.__hk.load(); return { days: Object.keys(s.days).length, total: s.total, cnt0: s.cnt[0], perf0: s.perf[0] || 0 }; });
  check("練習は今日の記録を増やさず、通した部屋と部屋帳には入る（ぴったりでないものは、ぴったりの数に入れない）", after.days === 1 && after.total === 6 && after.cnt0 === 2 && after.perf0 === 0 && (await page.locator(".share").count()) === 0, JSON.stringify(after));
  await page.click("#back"); await page.click("#go-ach");
  { const got = await page.locator(".achs div.got").count(), txt = await page.textContent(".achs");
    check("実績の画面：取れたものは★、まだのものは進み具合（ぴったりの数は今日・上級だけで練習を数えない）", got >= 3 && txt.includes("4/10") && txt.includes("6/100"), `${got} ${txt.slice(0, 80)}`); }
  check("続けて遊んだ日の最長は、日付が1日ずつ続くところだけ数える", await page.evaluate(() => window.__hk.maxStreak({ "2026-01-01": 1, "2026-01-02": 1, "2026-01-04": 1, "2026-01-05": 1, "2026-01-06": 1 }) === 3 && window.__hk.maxStreak({}) === 0));
  await page.click("#back"); await page.click("#go-dex");
  check("部屋帳に大きさごとの通した数が出る", (await page.locator(".res div").count()) === 4 && (await page.textContent(".res")).includes("2室") && (await page.textContent("h1")).includes("6室"));
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上・上級の6×8でも盤のますは40px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent.trim().slice(0, 6)) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.click("#back"); await p3.click("#go-p"); await p3.click('.lv button[data-lv="3"]');
    const r7 = await p3.evaluate(() => { const h = [...document.querySelectorAll("#board rect.hit")].map((e) => e.getBoundingClientRect()); return { minW: Math.min(...h.map((b) => b.width)), minH: Math.min(...h.map((b) => b.height)), over: document.documentElement.scrollWidth > innerWidth }; });
    check(`幅${w}px：上級の6×8でも盤のますは40×40px以上・はみ出さない`, r7.minW >= 40 && r7.minH >= 40 && !r7.over, JSON.stringify(r7));
    await p3.close();
  }
  { // 保存してあった置き方が壊れていたら使わない
    const pv = await newPage(); await pv.click("#howto-ok");
    const broken = await pv.evaluate((k) => {
      const g = window.__hk, d = g.todayKey(), list = g.dailyList(d), p = g.probOf(list[0]);
      let rock = null, gem = null, free = null;
      for (let r = 0; r < p.H; r++) for (let x = 0; x < p.W; x++) { if (!rock && p.cell[r][x] === 1) rock = [r, x]; if (!gem && p.cell[r][x] === 2) gem = [r, x]; if (!free && p.cell[r][x] === 0) free = [r, x]; }
      const grid = (cells, v = 1) => { const a = p.cell.map((row) => row.map(() => 0)); cells.forEach(([r, x]) => { a[r][x] = v; }); return a; };
      const cases = [{ put: grid([rock]), hint: [] }, { put: grid([gem]), hint: [] }, { put: grid([free], 3), hint: [] }, { put: grid([]).slice(1), hint: [] }, { put: grid([]), hint: [free], hints: 1 }, { put: grid([free]), hint: [free, free], hints: 2 }, { put: grid([free]), hint: [[99, 0]], hints: 1 }, { put: "x", hint: [] }];
      const out = cases.map((cc) => g.valid(p, Object.assign({ hints: 0, moves: 1 }, cc)));
      out.push(!g.valid(p, { put: grid([free], 2), hint: [free], hints: 1, moves: 2 })); // 正しいものは使う（反対にして並べる）
      localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list, res: [], cur: { i: 0, put: grid([rock]), hint: [], hints: 1, moves: 3 }, id: "a" } } }));
      return out; }, KEY);
    await pv.reload(); await pv.click("#go-d");
    check("壊れた途中経過（岩・宝石に鏡・鏡の値がちがう・形がちがう・ヒントのますに鏡が無い・同じヒント2回・盤の外・型がちがう）は使わず、はじめから", broken.every((x) => x === false) && nPut((await curT(pv)).put) === 0 && (await curT(pv)).hints === 0, JSON.stringify(broken));
    await pv.close(); }
  { // 別のタブで同じ問題のヒントが多く保存されていたら、古いタブで届けても多いほうを記録する
    const pz = await newPage(); await pz.click("#howto-ok"); await pz.click("#go-d");
    await pz.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)), p = window.__hk.cur().p; s.runs.d.cur = { i: 0, put: p.cell.map((row) => row.map(() => 0)), hint: [], hints: 2, moves: 999 }; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await solveNow(pz);
    const rz = await pz.evaluate(() => window.__hk.load().runs.d.res[0]);
    check("別のタブで保存したヒントの数を、古いタブで届けても消さない（★を増やさない）", rz && rz.m === 0 && rz.h === 2 && (await pz.locator(".verdict .stars .off").textContent()).length === 2, JSON.stringify(rz));
    await pz.close(); }
  { // 同じ回数で古いタブが保存しても、保存済みのヒントの鏡と数を消さない（2026-11-05 CodeRabbit）
    const py = await newPage(); await py.click("#howto-ok"); await py.click("#go-d");
    const fc = await freeCell(py);
    await py.evaluate(([k, fr, fcc]) => { const s = JSON.parse(localStorage.getItem(k)), p = window.__hk.cur().p; let hr = -1, hc = -1; for (let r = 0; r < p.H && hr < 0; r++) for (let c = 0; c < p.W; c++) if (p.cell[r][c] === 0 && !(r === fr && c === fcc)) { hr = r; hc = c; break; } const put = p.cell.map((row) => row.map(() => 0)); put[hr][hc] = 1; s.runs.d.cur = { i: 0, put, hint: [[hr, hc]], hints: 1, moves: 1 }; localStorage.setItem(k, JSON.stringify(s)); }, [KEY, fc[0], fc[1]]);
    await py.click(cellSel(...fc));
    const ry = await py.evaluate(() => window.__hk.load().runs.d.cur);
    check("同じ回数で古いタブが保存しても、保存済みのヒントの鏡と数を残す（上書きしない）", ry && ry.hints === 1 && ry.moves === 1 && ry.hint.length === 1 && nPut(ry.put) === 1 && ry.put[ry.hint[0][0]][ry.hint[0][1]] === 1, JSON.stringify(ry));
    { // 古いタブで手数が保存済みを超えても、保存済みのヒントの鏡は消さない（2026-11-05 CodeRabbit）
      const fc2 = await freeCell(py); await py.click(cellSel(...fc2)); await py.click(cellSel(...fc2));
      const rw = await py.evaluate(() => ({ s: window.__hk.load().runs.d.cur, c: window.__hk.cur() }));
      check("古いタブで手数が保存済みを超えても、保存済みのヒントの鏡と数を消さない（画面にも写す）", rw.s.moves >= 2 && rw.s.hints === 1 && rw.s.hint.length === 1 && rw.s.put[rw.s.hint[0][0]][rw.s.hint[0][1]] === 1 && rw.c.hint.length === 1, JSON.stringify(rw.s)); }
    await py.close(); }
  { // 保存できないブラウザでも遊べる
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    await pb.click(cellSel(...(await freeCell(pb))));
    check("保存できないブラウザでも、今日の1問目で鏡を置ける", (await pb.textContent("header")).includes("1/3") && nPut((await curT(pb)).put) === 1);
    await solveNow(pb);
    check("保存できないブラウザでも、1問目を届けられる", (await curT(pb)).done);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗するとき
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "hikari-michi-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__hk, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__hk; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__hk, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__hk.mode())) !== "h");
    await pm.close(); }
  { const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__hk, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__hk; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、部屋帳の数は多いほう", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, cnt: { 0: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, cnt: { 0: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.cnt["0"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("同じ問題の途中経過を読み合わせるとき、ヒントの数だけでなくヒントの鏡も残す（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], id: "x", res: [] }, cu = (h, mv) => { const put = [[0, 0, 0], [0, 0, 0]]; const hint = []; if (h) { put[1][2] = 2; hint.push([1, 2]); } return { i: 0, put, hint, hints: h, moves: mv }; }; const run = (ma, mb) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { cur: cu(1, ma) }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { cur: cu(0, mb) }) } }))); const r = g.load(); mem = null; return r.runs.d.cur; }; return [run(4, 4), run(4, 6)].every((c) => c.hints === 1 && c.hint.length === 1 && c.put[1][2] === 2); }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    check("進み具合は終えた問題の数を先に比べる（鏡を動かした回数が多くても、終えた問題のある記録を消さない）", await pn.evaluate((K) => { const g = window.__hk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }, { seed: 2, lv: 0, idx: 1 }], id: "x" }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { res: [], cur: { i: 0, put: [], hint: [], hints: 0, moves: 1500 } }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }], cur: null }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    { // できたときの確かめ（1回目の読み）と保存の読み直し（2回目）のあいだに別のタブが新しい回を保存した状態を作り、できた画面が出ないことを動きで見る（2026-11-05 CodeRabbit）
      await pn.evaluate(() => { location.hash = ""; }); await pn.reload(); await pn.click("#go-p"); await pn.click('.lv button[data-lv="0"]');
      const r = await pn.evaluate((K) => { const g = window.__hk, c = g.cur(); const sol = g.T.solve(c.p, null, 20).put; c.put = sol.map((x) => x.slice()); const orig = Storage.prototype.getItem; let n = 0; Storage.prototype.getItem = function (k) { const v = orig.call(this, k); if (k !== K || ++n < 2) return v; const s = JSON.parse(v); s.runs.p = Object.assign({}, s.runs.p, { id: "other-tab" }); return JSON.stringify(s); }; try { g.deliver(); } finally { Storage.prototype.getItem = orig; } return { n, verdict: !!document.querySelector(".verdict"), done: g.cur().done }; }, KEY);
      check("できたときに別のタブで回が変わって保存できなかったら、できた画面を出さない", r.n >= 2 && !r.verdict && !r.done, JSON.stringify(r)); }
    await pn.evaluate(() => { location.hash = ""; }); await pn.reload(); await pn.click("#go-p"); await pn.click('.lv button[data-lv="3"]');
    check("練習の上級（6×8）も、ヒントのボタンが無い", (await pn.locator("#hint").count()) === 0 && (await pn.evaluate(() => window.__hk.cur().hard)) === true);
    await pn.close(); }
  { // 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
    const sample = { "hikari-michi-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-04": { m: [0, 1, 0] } }, hdays: {}, cnt: { 0: 3, 1: 2 }, perf: {}, total: 5, runs: {}, kofi: {}, ach: {}, t: 1 }), "a11y-v1": JSON.stringify({ read: true }) };
    await checkTransfer({ browser, url, game: "hikari-michi", sample, check, open: async (page) => { await page.evaluate(() => { const d = document.getElementById("howto"); if (d.open) d.close(); }); } });
  }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  if (browser) await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# ひかり道 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);

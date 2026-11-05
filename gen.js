// ひかり道：左から入る光を鏡で曲げ、宝石を全部通して出口へ届ける。make(seed, L) が種から部屋を作り、solve がいちばん少ない鏡の数を数える。
(function (root) {
  "use strict";
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 大きさ：横 W・縦 H・宝石 gem・岩 rock・はじめからある鏡 fix・いちばん少ない鏡の数 min（幅320pxでも1ますが40px以上になるよう横は6まで）
  const SIZES = [
    { name: "小部屋", W: 5, H: 5, gem: 2, rock: 3, fix: 0, min: [2, 3] },
    { name: "広間", W: 6, H: 6, gem: 3, rock: 5, fix: 1, min: [3, 4] },
    { name: "大広間", W: 6, H: 7, gem: 3, rock: 6, fix: 1, min: [4, 6] },
  ];
  const HARD = { name: "上級", W: 6, H: 8, gem: 4, rock: 7, fix: 2, min: [5, 8] };
  // ますの中身：0 空き・1 岩（光が止まる）・2 宝石（光は通りぬける）・3 はじめからの鏡「／」・4 はじめからの鏡「＼」
  // 置いた鏡：1「／」・2「＼」。向き：0 右・1 下・2 左・3 上
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const SLASH = [3, 2, 1, 0], BACK = [1, 0, 3, 2]; // 「／」右→上・下→左・左→下・上→右、「＼」右→下・下→右・左→上・上→左
  const turn = (d, m) => (m === 1 ? SLASH[d] : m === 2 ? BACK[d] : d);
  const mirrorOf = (v, put) => (v === 3 ? 1 : v === 4 ? 2 : put || 0);
  // 光をたどる。put[r][c] は置いた鏡。end：exit（外へ出た所 r,c,d）・rock・loop
  function trace(p, put) {
    const seen = new Set(), pts = [[p.lr, -1]], gems = new Set();
    let r = p.lr, c = 0, d = 0;
    for (let n = 0; n < 4 * p.W * p.H + 4; n++) {
      if (r < 0 || r >= p.H || c < 0 || c >= p.W) return { pts, gems, end: { type: "exit", r: r - DY[d], c: c - DX[d], d } };
      const k = (r * p.W + c) * 4 + d;
      if (seen.has(k)) return { pts, gems, end: { type: "loop" } };
      seen.add(k);
      const v = p.cell[r][c];
      if (v === 1) { pts.push([r, c]); return { pts, gems, end: { type: "rock", r, c } }; }
      if (v === 2) gems.add(r * p.W + c);
      const nd = turn(d, mirrorOf(v, put && put[r] ? put[r][c] : 0));
      if (nd !== d) pts.push([r, c]);
      d = nd; r += DY[d]; c += DX[d];
    }
    return { pts, gems, end: { type: "loop" } };
  }
  const isGoal = (p, e) => e.type === "exit" && e.r === p.goal.r && e.c === p.goal.c && e.d === p.goal.d;
  const solved = (p, put) => { const t = trace(p, put); return isGoal(p, t.end) && t.gems.size === p.gems.length; };
  // ゆるめた数え方（同じますを2回通るときの食いちがいを気にしない）で、そこから出口までの鏡の数の下限を出す
  function relaxed(p, fixed) {
    const G = p.gems.length, full = (1 << G) - 1, gi = new Map(p.gems.map(([r, c], i) => [r * p.W + c, i]));
    const S = p.W * p.H * 4 * (1 << G), D = new Uint8Array(S).fill(255), idx = (r, c, d, m) => (((r * p.W + c) * 4 + d) << G) | m;
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < p.H; r++) for (let c = 0; c < p.W; c++) {
        const v = p.cell[r][c]; if (v === 1) continue;
        const f = fixed && fixed[r] ? fixed[r][c] : 0, b = gi.has(r * p.W + c) ? 1 << gi.get(r * p.W + c) : 0;
        for (let d = 0; d < 4; d++) {
          const opts = v === 3 || v === 4 ? [[turn(d, v - 2), 0]] : v === 2 ? [[d, 0]] : f ? [[turn(d, f), 0]] : [[d, 0], [SLASH[d], 1], [BACK[d], 1]];
          for (let m = 0; m <= full; m++) {
            const m2 = m | b; let best = D[idx(r, c, d, m)];
            for (const [nd, w] of opts) {
              const nr = r + DY[nd], nc = c + DX[nd];
              let rest;
              if (nr < 0 || nr >= p.H || nc < 0 || nc >= p.W) rest = r === p.goal.r && c === p.goal.c && nd === p.goal.d && m2 === full ? 0 : 255;
              else rest = D[idx(nr, nc, nd, m2)];
              if (rest < 255 && rest + w < best) best = rest + w;
            }
            if (best < D[idx(r, c, d, m)]) { D[idx(r, c, d, m)] = best; changed = true; }
          }
        }
      }
    }
    return { D, idx, gi, full };
  }
  // いちばん少ない鏡の数と、その置き方の1つ。fixed[r][c] は動かせない鏡（ヒントで置いた鏡、d には数えない・put には入る）。max を超えたら null
  function solve(p, fixed, max = 12) {
    const R = relaxed(p, fixed), G = R.gi;
    const h0 = R.D[R.idx(p.lr, 0, 0, 0)];
    if (h0 === 255) return null;
    const lo = (h0 + 1) >> 1;
    const dec = new Map(), fx = new Set(); // ます → 0（まっすぐ）・1・2。fx：ヒントで動かせない鏡（数に入らないので refl にも数えない）
    if (fixed) for (let r = 0; r < p.H; r++) for (let c = 0; c < p.W; c++) if (fixed[r] && fixed[r][c]) { dec.set(r * p.W + c, fixed[r][c]); fx.add(r * p.W + c); }
    let found = null;
    function dfs(r, c, d, m, used, refl, budget, seen) {
      for (;;) {
        if (r < 0 || r >= p.H || c < 0 || c >= p.W) {
          const pr = r - DY[d], pc = c - DX[d];
          if (pr === p.goal.r && pc === p.goal.c && d === p.goal.d && m === R.full) { found = new Map(dec); return true; }
          return false;
        }
        const v = p.cell[r][c]; if (v === 1) return false;
        const h = R.D[R.idx(r, c, d, m)]; if (h === 255 || ((refl + h + 1) >> 1) > budget) return false; // 置いた鏡で曲がる回数 refl＋残りの下限 h。1枚の鏡は表と裏で2回まで使えるので、鏡の数はその半分以上
        const key = (r * p.W + c) * 4 + d; if (seen.has(key)) return false;
        const cell = r * p.W + c;
        if (G.has(cell)) m |= 1 << G.get(cell);
        if (v === 0 && !dec.has(cell)) {
          seen.add(key);
          for (const ch of [0, 1, 2]) {
            if (ch && used + 1 > budget) continue;
            dec.set(cell, ch);
            const nd = turn(d, ch);
            if (dfs(r + DY[nd], c + DX[nd], nd, m, used + (ch ? 1 : 0), refl + (ch ? 1 : 0), budget, new Set(seen))) return true;
            dec.delete(cell);
          }
          return false;
        }
        seen.add(key);
        if (v === 0 && dec.get(cell) && !fx.has(cell)) refl++;
        d = turn(d, v === 0 ? dec.get(cell) : mirrorOf(v, 0));
        r += DY[d]; c += DX[d];
      }
    }
    for (let b = lo; b <= max; b++) {
      if (dfs(p.lr, 0, 0, 0, 0, 0, b, new Set())) {
        const put = [...Array(p.H)].map(() => Array(p.W).fill(0));
        for (const [cell, ch] of found) if (ch) put[Math.floor(cell / p.W)][cell % p.W] = ch;
        return { d: b, put };
      }
    }
    return null;
  }
  // 置き方 put の鏡の数
  const count = (put) => put.flat().filter(Boolean).length;
  // 部屋を作る：先に光の道（鏡で曲がる）を作り、道の上に宝石、道の外に岩と鏡を置いてから、いちばん少ない数を数え直す
  function make(seed, L) {
    const R = rng(seed), pick = (a) => a[Math.floor(R() * a.length)];
    for (let t = 0; t < 800; t++) {
      const cell = [...Array(L.H)].map(() => Array(L.W).fill(0)), lr = Math.floor(R() * L.H);
      // 道：左から入り、ときどき曲がって、外へ出る（同じますを2回通らない）
      const path = [], turns = [], used = new Set();
      let r = lr, c = 0, d = 0, ok = false;
      for (let n = 0; n < L.W * L.H; n++) {
        if (r < 0 || r >= L.H || c < 0 || c >= L.W) { ok = true; break; }
        if (used.has(r * L.W + c)) break;
        used.add(r * L.W + c); path.push([r, c, d]);
        const run = path.length - (turns.length ? turns[turns.length - 1].i : 0);
        if (run >= 2 && R() < 0.45) {
          const nd = R() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
          turns.push({ i: path.length - 1, r, c, m: SLASH[d] === nd ? 1 : 2 });
          path[path.length - 1].push(nd);
          d = nd;
        }
        r += DY[d]; c += DX[d];
      }
      if (!ok || turns.length < L.min[0] || path.length < L.W + 2) continue;
      const exitCell = path[path.length - 1], goal = { r: exitCell[0], c: exitCell[1], d };
      if (goal.c === L.W - 1 && goal.d === 0 && goal.r === lr && turns.length === 0) continue;
      // はじめからある鏡：曲がり角のいくつかを置いておく
      const tset = new Set(turns.map((x) => x.r * L.W + x.c));
      const fixT = turns.slice();
      for (let k = 0; k < L.fix && fixT.length; k++) { const x = fixT.splice(Math.floor(R() * fixT.length), 1)[0]; cell[x.r][x.c] = x.m === 1 ? 3 : 4; }
      // 宝石：まっすぐ通るますに
      const straight = path.filter(([pr, pc]) => !tset.has(pr * L.W + pc));
      const gems = [];
      for (let k = 0; k < L.gem && straight.length; k++) { const x = straight.splice(Math.floor(R() * straight.length), 1)[0]; cell[x[0]][x[1]] = 2; gems.push([x[0], x[1]]); }
      if (gems.length < L.gem) continue;
      // 岩：道の外に
      const off = []; for (let rr = 0; rr < L.H; rr++) for (let cc = 0; cc < L.W; cc++) if (!used.has(rr * L.W + cc)) off.push([rr, cc]);
      if (off.length < L.rock) continue;
      for (let k = 0; k < L.rock && off.length; k++) { const x = off.splice(Math.floor(R() * off.length), 1)[0]; cell[x[0]][x[1]] = 1; }
      gems.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const p = { W: L.W, H: L.H, lr, cell, gems, goal, name: L.name };
      const s = solve(p, null, L.min[1]);
      if (!s || s.d < L.min[0] || s.d > L.min[1]) continue;
      p.d = s.d; p.sol = s.put;
      return p;
    }
    return null;
  }
  const B = { rng, seedOf, SIZES, HARD, DX, DY, turn, trace, solved, isGoal, solve, count, make };
  if (typeof module !== "undefined") module.exports = B; else root.HIK = B;
})(this);

// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題は入れず、見本の部屋だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const S = 80, X0 = 700, Y0 = 130, cx = (c) => X0 + S * c + S / 2, cy = (r) => Y0 + S * r + S / 2;
  const cells = [...Array(5)].map((_, r) => [...Array(5)].map((_, c) => `<rect x="${X0 + S * c}" y="${Y0 + S * r}" width="${S}" height="${S}" fill="#ffffff08" stroke="#ffffff1c" stroke-width="2"/>`).join("")).join("");
  const mir = (r, c, m) => { const h = S * 0.34; return m === 1 ? `<line x1="${cx(c) - h}" y1="${cy(r) + h}" x2="${cx(c) + h}" y2="${cy(r) - h}"/>` : `<line x1="${cx(c) - h}" y1="${cy(r) - h}" x2="${cx(c) + h}" y2="${cy(r) + h}"/>`; };
  const gem = (r, c, col) => { const h = S * 0.26; return `<polygon points="${cx(c)},${cy(r) - h} ${cx(c) + h},${cy(r)} ${cx(c)},${cy(r) + h} ${cx(c) - h},${cy(r)}" fill="${col}" stroke="#fff" stroke-width="3" style="filter:drop-shadow(0 0 10px ${col})"/>`; };
  const svg = `<svg width="1200" height="630" style="position:absolute;left:0;top:0">${cells}
    <rect x="${cx(3) - S * 0.36}" y="${cy(0) - S * 0.36}" width="${S * 0.72}" height="${S * 0.72}" rx="16" fill="#3a4160" stroke="#555f86" stroke-width="3"/>
    <rect x="${cx(1) - S * 0.36}" y="${cy(3) - S * 0.36}" width="${S * 0.72}" height="${S * 0.72}" rx="16" fill="#3a4160" stroke="#555f86" stroke-width="3"/>
    <circle cx="${X0 - 18}" cy="${cy(1)}" r="11" fill="#ffd45a"/>
    <polyline points="${X0 - 18},${cy(1)} ${cx(2)},${cy(1)} ${cx(2)},${cy(4)} ${cx(4)},${cy(4)} ${cx(4)},${cy(2)} ${X0 + 5 * S + 22},${cy(2)}" fill="none" stroke="#ffd45a" stroke-width="8" stroke-linejoin="round" style="filter:drop-shadow(0 0 8px #ffd45a)"/>
    <g stroke="#dfe6f5" stroke-width="7" stroke-linecap="round">${mir(1, 2, 2)}${mir(4, 2, 2)}${mir(4, 4, 1)}${mir(2, 4, 1)}</g>
    ${gem(1, 1, "#ff6b8a")}${gem(4, 3, "#5cc8ff")}
    <circle cx="${X0 + 5 * S + 22}" cy="${cy(2)}" r="11" fill="#5fd39a"/></svg>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#151a2e;color:#eef1fa;position:relative;overflow:hidden">
    ${svg}
    <div style="position:relative;font-size:34px;color:#ffd45a;letter-spacing:.1em">だれでも同じ 1日3問・3分</div>
    <div style="position:relative;font-size:104px;font-weight:900;margin-top:16px;letter-spacing:.06em;text-shadow:0 0 30px #ffd45a66">ひかり道</div>
    <div style="position:relative;font-size:40px;margin-top:18px;line-height:1.5">いちばん少ない鏡で、<br>光を出口に届けられる？</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();

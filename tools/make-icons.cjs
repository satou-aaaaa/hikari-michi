// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、鏡で曲がる金色の光と宝石。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#151a2e"/>
      <circle cx="14" cy="30" r="6" fill="#ffd45a"/>
      <polyline points="14,30 62,30 62,74 92,74" fill="none" stroke="#ffd45a" stroke-width="7" stroke-linejoin="round"/>
      <g stroke="#dfe6f5" stroke-width="5" stroke-linecap="round"><line x1="52" y1="20" x2="72" y2="40"/><line x1="52" y1="84" x2="72" y2="64"/></g>
      <polygon points="40,20 50,30 40,40 30,30" fill="#5cc8ff" stroke="#fff" stroke-width="2"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();

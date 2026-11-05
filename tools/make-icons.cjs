// アプリのアイコン（icon-192.png・icon-512.png・icon-512-maskable.png）を作る。maskable は絵を中心から0.75倍にして、丸く切られても欠けないようにする（安全な範囲は中心の直径80%）。紺の地に、鏡で曲がる金色の光と宝石。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [s, name, k] of [[192, "icon-192.png", 1], [512, "icon-512.png", 1], [512, "icon-512-maskable.png", 0.75]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#151a2e"/><g transform="translate(50 50) scale(${k}) translate(-50 -50)">
      <circle cx="14" cy="30" r="6" fill="#ffd45a"/>
      <polyline points="14,30 62,30 62,74 92,74" fill="none" stroke="#ffd45a" stroke-width="7" stroke-linejoin="round"/>
      <g stroke="#dfe6f5" stroke-width="5" stroke-linecap="round"><line x1="52" y1="20" x2="72" y2="40"/><line x1="52" y1="64" x2="72" y2="84"/></g>
      <polygon points="40,20 50,30 40,40 30,30" fill="#5cc8ff" stroke="#fff" stroke-width="2"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", name), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();

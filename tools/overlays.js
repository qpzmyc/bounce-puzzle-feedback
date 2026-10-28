// Renders the hook clips' text as transparent 1080x1920 PNGs, since this
// ffmpeg has no drawtext. Three looks for Cheng to pick from:
//   caption  the posted videos' captions: Helvetica, heavy, white, black outline
//   amber    the same, with the number or key words in the captions' amber
//   brand    the game's own look: Unbounded, white, coral, a purple glow
//   node tools/overlays.js work/overlays
const { chromium } = require(process.env.HOME + '/.claude/skills/ultraloop/scripts/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

const out = path.resolve(process.argv[2] || 'work/overlays');
fs.mkdirSync(out, { recursive: true });

const HELV = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:900";
const STYLES = {
  caption: { font: HELV, color: '#fff', hi: '#fff', stroke: s => `-webkit-text-stroke:${Math.round(s / 7)}px #000;paint-order:stroke fill` },
  amber: { font: HELV, color: '#fff', hi: '#ffc83d', stroke: s => `-webkit-text-stroke:${Math.round(s / 7)}px #000;paint-order:stroke fill` },
  brand: { font: "font-family:'Unbounded',sans-serif;font-weight:800", color: '#fff', hi: '#ff6b6b',
           stroke: () => 'text-shadow:0 0 28px rgba(124,58,237,.95),0 0 6px rgba(124,58,237,.9),0 6px 0 #1a1033' },
};

// name: [html, font px, top of the text block in px]. <b> marks the highlight.
const TEXTS = {
  'attempt-78': ['Attempt<br><b style="font-size:1.9em">78</b>', 150, 560],
  'pov-hour': ["POV: you've been stuck on this level for <b>an hour</b>", 88, 330],
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [style, st] of Object.entries(STYLES)) {
    for (const [name, [html, size, top]] of Object.entries(TEXTS)) {
      await page.setContent(`<html><head>
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@800&display=block" rel="stylesheet"></head>
        <body style="margin:0;background:transparent">
        <div style="position:absolute;left:70px;right:70px;top:${top}px;text-align:center;${st.font};
          font-size:${size}px;line-height:1.05;color:${st.color};${st.stroke(size)}">${html.replace(/<b style="/g, '<b style="color:HI;').replace(/<b>/g, '<b style="color:HI">').replace(/HI/g, st.hi)}</div></body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `${name}-${style}.png`), omitBackground: true });
    }
  }
  await browser.close();
})();

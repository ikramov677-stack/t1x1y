// Self-contained renderer (Playwright + ffmpeg):
//   node render.mjs events               → events.json (sound cues + subtitles)
//   node render.mjs stills 3 20 56.5 …   → stills/t_<sec>.png
//   node render.mjs video [--fps 30] [--workers 4] [--from a --to b] → out/video.mp4
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname), W = 1920, H = 1080;
const args = process.argv.slice(2), cmd = args[0], opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((q, r) => { const p = path.join(HERE, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const URL0 = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
async function open(q = '') {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(URL0 + q); await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 }); return page;
}
if (cmd === 'events') {
  const p = await open(); const ev = await p.evaluate(() => ({ dur: window.DUR, ev: window.EV }));
  fs.writeFileSync(path.join(HERE, 'events.json'), JSON.stringify(ev)); console.log('events', ev.ev.length, 'dur', ev.dur);
} else if (cmd === 'stills') {
  const p = await open(); fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
  for (const s of args.slice(1)) { await p.evaluate(t => window.render(t), +s); await p.screenshot({ path: path.join(HERE, 'stills', `t_${s}.png`) }); console.log('still', s); }
} else if (cmd === 'video') {
  const FPS = +opt('--fps', 30), NW = +opt('--workers', 4), p0 = await open(), DUR = await p0.evaluate(() => window.DUR); await p0.close();
  const a = Math.round(+opt('--from', 0) * FPS), b = Math.round(+opt('--to', DUR) * FPS), out = path.join(HERE, 'out'); fs.mkdirSync(out, { recursive: true });
  const per = Math.ceil((b - a) / NW), t0 = Date.now(); let done = 0;
  const segs = await Promise.all([...Array(NW).keys()].map(async w => {
    const f0 = a + w * per, f1 = Math.min(b, f0 + per), file = path.join(out, `seg${w}.mp4`); if (f0 >= f1) return null;
    const page = await open();
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
      if (++done % 300 === 0) console.log(`${done}/${b - a} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end(); await new Promise(ok => ff.on('close', ok)); await page.close(); return file;
  }));
  const list = path.join(out, 'segs.txt'); fs.writeFileSync(list, segs.filter(Boolean).map(f => `file '${f}'`).join('\n'));
  await new Promise((ok, no) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(out, 'video.mp4')], { stdio: 'inherit' }).on('close', c => c ? no(c) : ok()));
  console.log('video ok', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close(); server.close();

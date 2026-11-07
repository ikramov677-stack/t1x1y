// Resumable render: node core/render/chunks.mjs <demo> <chunkdir> [--fps 30] [--workers 4] [--size WxH] [--chunk 60]
// Each chunk of frames becomes <chunkdir>/c_XXXX.mp4; existing chunks are skipped, so a killed run can be restarted.
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { openDemo, closeServer, requireDemo, takeSize } from '/root/lemo-opuscar/core/render/page.mjs';
const args = process.argv.slice(2), { w: W, h: H } = takeSize(args), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(args[0]), cdir = path.resolve(args[1]);
const FPS = +opt('--fps', 30), WK = +opt('--workers', 4), CH = +opt('--chunk', 60);
fs.mkdirSync(cdir, { recursive: true });
const probe = await openDemo(dir, { w: W, h: H, q: '' }); const DUR = await probe.page.evaluate(() => window.DUR); await probe.browser.close();
const TOTAL = Math.round(DUR * FPS), N = Math.ceil(TOTAL / CH), name = i => `c_${String(i).padStart(4, '0')}.mp4`;
const queue = [...Array(N).keys()].filter(i => !fs.existsSync(path.join(cdir, name(i))));
console.log('frames', TOTAL, 'chunks', N, 'todo', queue.length); const t0 = Date.now();
await Promise.all([...Array(WK)].map(async (_, w) => {
  if (!queue.length) return;
  const { browser, page } = await openDemo(dir, { w: W, h: H, q: '' });
  while (queue.length) {
    const i = queue.shift(), a = i * CH, b = Math.min(TOTAL, a + CH), tmp = `tmp_${i}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', tmp], { cwd: cdir, stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = a; f < b; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); const code = await closed;
    if (code !== 0) { console.error('ffmpeg failed chunk', i); process.exit(1); }
    fs.renameSync(path.join(cdir, tmp), path.join(cdir, name(i)));
    console.log(`w${w} chunk ${i}/${N} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
}));
fs.writeFileSync(path.join(cdir, 'list.txt'), [...Array(N).keys()].map(i => `file '${name(i)}'`).join('\n'));
console.log('ALL CHUNKS DONE'); closeServer();

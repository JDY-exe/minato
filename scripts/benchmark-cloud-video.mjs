// Run after `npm run build`. Media alone is throttled to 4 Mbps / 100 ms.
import { chromium, webkit } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const temporary = mkdtempSync(resolve(tmpdir(),'cloud-video-benchmark-'));
const longFile = resolve(temporary,'long.mp4');
const generated = spawnSync('ffmpeg',['-v','error','-y','-stream_loop','9','-i','public/clouds/cloud-video.mp4','-map','0:v:0','-an','-c','copy','-movflags','+faststart',longFile]);
if (generated.status !== 0) { rmSync(temporary,{recursive:true,force:true}); throw new Error(generated.stderr?.toString() || 'FFmpeg unavailable'); }
const metadata = JSON.parse(readFileSync('public/clouds/video.json','utf8'));
const clips = [readFileSync('public/clouds/cloud-video.mp4'),readFileSync(longFile)];
let clip = clips[0], duration = metadata.duration, sample;
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2' };
const server = createServer((request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  if (path === '/clouds/video.json') {
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({...metadata,duration})); return;
  }
  if (path === '/clouds/cloud-video.mp4') {
    const bytes = clip, current = sample;
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]),bytes.length-1) : bytes.length-1;
    current.requests++;
    response.writeHead(range ? 206 : 200,{
      'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,
      ...(range ? {'Content-Range':`bytes ${start}-${end}/${bytes.length}`} : {}),
    });
    let position = start, timer;
    function send() {
      if (response.destroyed) return;
      const next = Math.min(end+1,position+32768);
      current.sent += next-position;
      response.write(bytes.subarray(position,next)); position = next;
      if (position > end) response.end();
      else timer = setTimeout(send,32768/500000*1000);
    }
    timer = setTimeout(send,100);
    response.on('close',() => clearTimeout(timer)); return;
  }
  try {
    const file = resolve('dist',path === '/' ? 'index.html' : path.slice(1));
    response.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream');
    response.end(readFileSync(file));
  } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
try {
  for (const [engineName,engine] of Object.entries({chromium,webkit})) {
    const browser = await engine.launch();
    try {
      for (const [index,bytes] of clips.entries()) {
        clip = bytes; duration = metadata.duration*(index ? 10 : 1);
        const samples = [];
        for (let run = 0; run < 3; run++) {
          sample = {sent:0,requests:0};
          const page = await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light'});
          let atReady;
          await page.exposeFunction('markCloudReady',metrics => { atReady = {...metrics,bytesBeforeReady:sample.sent,requests:sample.requests}; });
          await page.addInitScript(() => {
            let textures = 0, mediaStart = 0, marked = false;
            const create = WebGL2RenderingContext.prototype.createTexture;
            WebGL2RenderingContext.prototype.createTexture = function() { textures++; return create.call(this); };
            const load = HTMLMediaElement.prototype.load;
            HTMLMediaElement.prototype.load = function() { if (this.getAttribute('src')) mediaStart = performance.now(); return load.call(this); };
            const observer = new MutationObserver(() => {
              if (marked || document.querySelector('.cloud-hero')?.dataset.state !== 'ready') return;
              marked = true;
              window.markCloudReady({navigationReadyMs:Math.round(performance.now()),mediaReadyMs:Math.round(performance.now()-mediaStart),textures});
            });
            observer.observe(document,{subtree:true,attributes:true,attributeFilter:['data-state']});
          });
          try {
            await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
            await page.waitForSelector('.cloud-hero[data-state="ready"]',{timeout:15000});
            samples.push({...atReady,totalBytes:bytes.length});
            if (index && run === 0) {
              await page.evaluate(() => {
                dispatchEvent(new WheelEvent('wheel',{deltaY:1}));
                scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*0.85);
              });
              await page.waitForFunction(duration => Number(document.querySelector('.cloud-hero canvas').dataset.time)>duration*0.8,duration,{timeout:15000});
              console.log(JSON.stringify({engine:engineName,longSeekTime:await page.locator('.cloud-hero canvas').getAttribute('data-time'),bytesAfterSeek:sample.sent,totalBytes:bytes.length}));
            }
          } finally { await page.close(); }
        }
        console.log(JSON.stringify({engine:engineName,duration,samples}));
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  rmSync(temporary,{recursive:true,force:true});
}

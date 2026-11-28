import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

for (const [signal,exitCode] of [['SIGINT',130],['SIGTERM',143]]) {
  test(`${signal} stops the encoder and removes partial preparation outputs`,{timeout:10000},async () => {
    const directory = mkdtempSync(resolve(tmpdir(),'cloud-cancel-test-'));
    const bin = resolve(directory,'bin'), output = resolve(directory,'output'), pidFile = resolve(directory,'encoder.pid');
    mkdirSync(bin); mkdirSync(output);
    const source = resolve(directory,'source.mp4');
    writeFileSync(source,'fixture');
    writeFileSync(resolve(bin,'ffprobe'),`#!${process.execPath}\nconsole.log(JSON.stringify({streams:[{codec_name:'h264',duration:'24',width:640,height:400,r_frame_rate:'30/1'}]}));\n`,{mode:0o755});
    writeFileSync(resolve(bin,'ffmpeg'),`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));
const staging=fs.readdirSync(${JSON.stringify(output)}).find(name=>name.startsWith('cloud-video.staging-'));
fs.writeFileSync(path.join(${JSON.stringify(output)},staging,'partial.mp4'),'partial');
setInterval(()=>{},1000);
`,{mode:0o755});
    const child = spawn(process.execPath,['scripts/prepare-clouds.mjs','--video',`--output=${output}`,source],{
      env:{...process.env,PATH:`${bin}:${process.env.PATH}`},stdio:'pipe',
    });
    let stderr = '', encoderPid;
    child.stderr.on('data',chunk => { stderr += chunk; });
    const closed = new Promise((resolve,reject) => {
      child.once('error',reject);
      child.once('close',(code,signal) => resolve({code,signal}));
    });
    try {
      for (let attempt = 0; !existsSync(pidFile) && attempt < 300; attempt++) await delay(10);
      assert.ok(existsSync(pidFile),`Encoder did not start: ${stderr}`);
      encoderPid = Number(readFileSync(pidFile,'utf8'));
      assert.ok(readdirSync(output).some(name => name.startsWith('cloud-video.staging-')));
      child.kill(signal);
      assert.deepEqual(await closed,{code:exitCode,signal:null});
      assert.deepEqual(readdirSync(output),[],'Partial outputs must not be published or left behind');
      assert.throws(() => process.kill(encoderPid,0),{code:'ESRCH'},'Encoder must not survive cancellation');
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      if (encoderPid) { try { process.kill(encoderPid,'SIGKILL'); } catch { /* Already reaped. */ } }
      rmSync(directory,{recursive:true,force:true});
    }
  });
}

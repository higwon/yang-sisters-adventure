import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers';
/* global fetch, WebSocket */

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const base = 'https://yang-sisters-adventure.higwon2.workers.dev';
const output = 'ui-review/redesign-2026-08-12';
const sizes = [{ name: '320', width: 320, height: 800 }, { name: '390', width: 390, height: 844 }, { name: '430', width: 430, height: 932 }, { name: '768', width: 768, height: 1024 }, { name: '1440', width: 1440, height: 900 }, { name: '1920', width: 1920, height: 1080 }];
const pages = ['home', 'schedule', 'board', 'expenses', 'settings'];
const metrics = [];
await mkdir(output, { recursive: true });
const profileDir = `${output}/chrome-profile`;
const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9333', `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let browserInfo;
  for (let index = 0; index < 30; index += 1) { try { browserInfo = await fetch('http://127.0.0.1:9333/json/version').then((response) => response.json()); break; } catch { await sleep(200); } }
  if (!browserInfo) throw new Error('Chrome debugging endpoint unavailable');
  const target = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); if (message.error) reject(new Error(message.error.message)); else resolve(message.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable'); await send('Network.enable');
  const profiles = await fetch(`${base}/api/auth/profiles`).then((response) => response.json()); const profile = profiles.profiles[0];
  const login = await fetch(`${base}/api/auth/profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: profile.id }) });
  const cookiePair = login.headers.get('set-cookie')?.split(';')[0]; if (!cookiePair) throw new Error('Session cookie unavailable'); const separator = cookiePair.indexOf('=');
  await send('Network.setCookie', { name: cookiePair.slice(0, separator), value: cookiePair.slice(separator + 1), domain: 'yang-sisters-adventure.higwon2.workers.dev', path: '/', secure: true, httpOnly: true });
  for (const size of sizes) for (const page of pages) {
    await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: size.width < 768 });
    await send('Page.navigate', { url: `${base}/trips/2/${page}` }); await sleep(2800);
    const layout = await send('Runtime.evaluate', { expression: `(() => {
      const candidates = ['.workspaceMain', '.content', '.boardPage', '.schedule-page', '.expenses-page', '.settings-page'];
      const blocks = Object.fromEntries(candidates.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        return [selector, { left: Math.round(rect.left), width: Math.round(rect.width), right: Math.round(rect.right) }];
      }));
      return { innerWidth, bodyScrollWidth: document.body.scrollWidth, documentScrollWidth: document.documentElement.scrollWidth, blocks };
    })()`, returnByValue: true });
    metrics.push({ page, viewport: size.name, ...layout.result.value });
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(`${output}/after-${page}-${size.name}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  await writeFile(`${output}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
  socket.close();
} finally { child.kill(); }

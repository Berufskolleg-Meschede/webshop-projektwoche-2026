// Headless-Chrome layout check at a phone width (CDP, no dependencies).
// Needs the built app served on :3001 (`npm run build && npm run server`).
// Usage: node scripts/mobile-layout-check.mjs <outDir> [width=375]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2];
const BASE = 'http://localhost:3001';
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--remote-debugging-port=9333',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'chr-'))}`,
    '--no-first-run',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9333/json')).json();
    if (targets.length) break;
  } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))
    .result?.result?.value;
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'));
};
const go = async (url) => {
  await send('Page.navigate', { url });
  await sleep(1500);
};
const overflow = () =>
  ev(
    `(()=>{const d=document.documentElement;return {scrollW:d.scrollWidth,innerW:window.innerWidth,overflowX:d.scrollWidth>window.innerWidth}})()`
  );
const click = (text, sel = 'button') =>
  ev(
    `(()=>{const b=[...document.querySelectorAll('${sel}')].find(x=>x.textContent.trim().includes(${JSON.stringify(text)})||(x.getAttribute('aria-label')||'').includes(${JSON.stringify(text)}));if(!b)return 'NO '+${JSON.stringify(text)};b.click();return 'ok'})()`
  );

const width = Number(process.argv[3] ?? 375);
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height: 812,
  deviceScaleFactor: 2,
  mobile: true,
});
const results = {};

await go(`${BASE}/`);
results.home = await overflow();
results.hamburgerVisible = await ev(
  `(()=>{const b=document.querySelector('button[aria-label^="Menü"]');return !!b&&b.getBoundingClientRect().width>0})()`
);
results.desktopNavVisible = await ev(
  `(()=>{const n=document.querySelector('header nav.hidden');return n?getComputedStyle(n).display:'none-element'})()`
);
await shot(`home-closed-${width}.png`);
await click('Menü öffnen');
await sleep(300);
results.menuOpen = await ev(`!!document.getElementById('mobile-menu')`);
await shot(`home-menu-open-${width}.png`);
results.menuNav = await ev(
  `(async()=>{await new Promise(r=>setTimeout(r,100));const b=[...document.querySelectorAll('#mobile-menu button')].find(x=>x.textContent==='Simulation');b.click();await new Promise(r=>setTimeout(r,400));return {menuClosed:!document.getElementById('mobile-menu'),onSimulation:document.body.innerText.includes('Neue Session')}})()`
);

// QR modal on the dashboard
const sid = (await (await fetch(`${BASE}/simulation/session/create`, { method: 'POST' })).json())
  .session_id;
await go(`${BASE}/`);
await click('Menü öffnen');
await sleep(200);
await ev(
  `[...document.querySelectorAll('#mobile-menu button')].find(x=>x.textContent==='Simulation').click()`
);
await sleep(300);
await ev(
  `(()=>{const i=document.getElementById('session-code');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'${sid}');i.dispatchEvent(new Event('input',{bubbles:true}))})()`
);
await click('Beitreten');
await sleep(1500);
results.dashboard = await overflow();
await click('QR-Code anzeigen');
await sleep(500);
results.qrModal = await ev(
  `(()=>{const d=document.querySelector('[role=dialog]').getBoundingClientRect();const svg=document.querySelector('[role=dialog] svg').getBoundingClientRect();return {dialogW:Math.round(d.width),dialogLeft:Math.round(d.left),dialogRight:Math.round(d.right),svgW:Math.round(svg.width)}})()`
);
results.qrOverflow = await overflow();
await shot(`qr-modal-${width}.png`);

// Shop in simulation mode: cart drawer + checkout
await go(`${BASE}/?session=${sid}&role=customer`);
await sleep(2500);
results.shopText = await ev(
  `document.body.innerText.replace(/https?:\\/\\/\\S+/g,'').replace(/\\n+/g,' | ').slice(0,300)`
);
results.addButtons = await ev(
  `(()=>{const add=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Warenkorb')&&!b.getAttribute('aria-label'));if(add.length<4)return add.length;add[0].click();add[0].click();add[3].click();return add.length})()`
);
await sleep(500);
await ev(`document.querySelector('button[aria-label^="Warenkorb öffnen"]').click()`);
await sleep(500);
results.cartDrawer = await ev(
  `(()=>{const a=document.querySelector('aside[aria-label="Warenkorb"]').getBoundingClientRect();return {drawerW:Math.round(a.width),viewport:window.innerWidth,fits:a.width<=window.innerWidth}})()`
);
results.cartOverflow = await overflow();
await shot(`cart-drawer-${width}.png`);
await click('Zur Kasse');
await sleep(600);
results.checkout = await ev(
  `(()=>{const d=document.querySelector('div.fixed.inset-0.z-40 > div');if(!d)return 'no checkout dialog';const r=d.getBoundingClientRect();const list=d.querySelector('ul');const lr=list?list.getBoundingClientRect():null;return {dialogW:Math.round(r.width),dialogRight:Math.round(r.right),cartListW:lr?Math.round(lr.width):null,viewport:window.innerWidth}})()`
);
results.checkoutOverflow = await overflow();
await shot(`checkout-${width}.png`);
console.log(JSON.stringify(results, null, 1));
ws.close();
chrome.kill();

// 极简 CDP 截图：通过已运行的 Edge 远程调试端口，精确设置视口后截图
const fs = await import('node:fs');
const WS = globalThis.WebSocket;

const [url, width, height, out] = process.argv.slice(2);
const PORT = 9333;

const listRes = await fetch(`http://127.0.0.1:${PORT}/json/new?`, { method: 'PUT' });
const target = await listRes.json();
const ws = new WS(target.webSocketDebuggerUrl);

let id = 0;
const pending = new Map();
const notify = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method && notify.has(msg.method)) {
    notify.get(msg.method)(msg);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

await new Promise((r) => (ws.onopen = r));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: Number(width) < 600,
});
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 1600));

const { result } = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
  clip: { x: 0, y: 0, width: Number(width), height: Number(height), scale: 1 },
});
fs.writeFileSync(out, Buffer.from(result.data, 'base64'));
ws.close();
console.log('saved', out);

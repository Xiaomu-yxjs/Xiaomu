/**
 * 荧光团（全局交互）
 * - 在卡片 / 标签 / 筛选框等「框」的边缘常驻 1~2 个发光小团
 * - 点击框时，光团沿弧线飞向另一个框，途中拖出一条光带
 * - 落点后光带与光团缓缓淡出，原框再补一个新的静态光团
 * - 配色取自四叶草发光图标：--accent #5ce090，中心近白、外圈化开
 *
 * 整层用文档坐标（absolute 定位在 body 起点），滚动时无需重算位置。
 */

const SELECTOR =
  '.card, .art-card, .chip, .tag, .badge, .btn, .filter, .facts, .hero-media, .shots';

type Edge = 'top' | 'right' | 'bottom' | 'left';
type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };
type Kind = 'card' | 'small' | 'panel';

interface Frame {
  el: HTMLElement;
  kind: Kind;
  desired: number;
  orbs: Orb[];
}

interface Orb {
  el: HTMLDivElement;
  frame: Frame;
  edge: Edge;
  t: number;
  home: Point;
  flying: boolean;
}

interface Flight {
  orb: Orb;
  from: Point;
  to: Point;
  ctrl: Point;
  startedAt: number;
  duration: number;
  fadeMs: number;
  progress: number;
  phase: 'fly' | 'fade';
  fadeAt: number;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const MAX_FRAMES = 48;
const MAX_FLIGHTS = 8;

const layer = document.createElement('div');
layer.className = 'firefly-layer';
layer.setAttribute('aria-hidden', 'true');

const canvas = document.createElement('canvas');
canvas.className = 'firefly-trail';
layer.appendChild(canvas);
document.body.appendChild(layer);

const ctx = canvas.getContext('2d');
let cssW = 0;
let cssH = 0;
let raf = 0;
let navTimer = 0;
let resizeTimer = 0;

const frames: Frame[] = [];
const frameMap = new WeakMap<HTMLElement, Frame>();
const flights: Flight[] = [];

function resizeCanvas() {
  const w = document.documentElement.clientWidth;
  const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  cssW = w;
  cssH = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  layer.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function docRect(el: HTMLElement): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    width: r.width,
    height: r.height,
  };
}

const EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
const randomEdge = (): Edge => EDGES[Math.floor(Math.random() * EDGES.length)];

/** 框边缘外侧的一点，t 是沿该边的位置比例 */
function pointAt(r: Rect, edge: Edge, t: number): Point {
  const off = 5;
  switch (edge) {
    case 'top':
      return { x: r.left + r.width * t, y: r.top - off };
    case 'bottom':
      return { x: r.left + r.width * t, y: r.top + r.height + off };
    case 'left':
      return { x: r.left - off, y: r.top + r.height * t };
    default:
      return { x: r.left + r.width + off, y: r.top + r.height * t };
  }
}

function spawnOrb(frame: Frame): boolean {
  const rect = docRect(frame.el);
  if (!rect) return false;

  const size = frame.kind === 'small' ? 6 + Math.random() * 2 : 9 + Math.random() * 3;
  const edge = randomEdge();
  const t = 0.16 + Math.random() * 0.68;
  const home = pointAt(rect, edge, t);

  const el = document.createElement('div');
  el.className = 'firefly';
  el.style.setProperty('--orb', `${size.toFixed(1)}px`);
  el.style.setProperty('--dur', `${(2.8 + Math.random() * 2.6).toFixed(2)}s`);
  el.style.setProperty('--delay', `${(-Math.random() * 4).toFixed(2)}s`);
  el.style.transform = `translate(${home.x}px, ${home.y}px)`;
  const dot = document.createElement('span');
  dot.className = 'firefly-dot';
  el.appendChild(dot);
  layer.appendChild(el);

  frame.orbs.push({ el, frame, edge, t, home, flying: false });
  return true;
}

function fillOrbs(frame: Frame) {
  while (frame.orbs.length < frame.desired) {
    if (!spawnOrb(frame)) break;
  }
}

function repositionOrbs() {
  for (const frame of frames) {
    const rect = docRect(frame.el);
    if (!rect) continue;
    for (const orb of frame.orbs) {
      if (orb.flying) continue;
      orb.home = pointAt(rect, orb.edge, orb.t);
      orb.el.style.transform = `translate(${orb.home.x}px, ${orb.home.y}px)`;
    }
    fillOrbs(frame);
  }
}

function buildFrames() {
  const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    .filter((el) => !el.hidden && el.getClientRects().length > 0)
    .slice(0, MAX_FRAMES);

  for (const el of els) {
    const kind: Kind = el.matches('.chip, .tag, .badge, .btn')
      ? 'small'
      : el.matches('.card, .art-card')
        ? 'card'
        : 'panel';
    const frame: Frame = { el, kind, desired: kind === 'small' ? 1 : 2, orbs: [] };
    frames.push(frame);
    frameMap.set(el, frame);
    fillOrbs(frame);
  }
}

function pickTarget(origin: Frame): Frame | null {
  const connected = frames.filter(
    (f) => f !== origin && f.el.isConnected && !f.el.hidden && f.el.getClientRects().length > 0,
  );
  const inView = connected.filter((f) => {
    const r = f.el.getBoundingClientRect();
    return (
      r.bottom > -30 &&
      r.top < window.innerHeight + 30 &&
      r.right > 0 &&
      r.left < window.innerWidth
    );
  });
  const pool = inView.length ? inView : connected;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function targetPoint(frame: Frame): Point | null {
  if (frame.orbs.length && Math.random() < 0.7) {
    const orb = frame.orbs[Math.floor(Math.random() * frame.orbs.length)];
    return { ...orb.home };
  }
  const rect = docRect(frame.el);
  return rect ? pointAt(rect, randomEdge(), 0.2 + Math.random() * 0.6) : null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function bezier(f: Flight, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * f.from.x + 2 * u * t * f.ctrl.x + t * t * f.to.x,
    y: u * u * f.from.y + 2 * u * t * f.ctrl.y + t * t * f.to.y,
  };
}

/** 逐段描出光带：越靠近光团越亮越粗，尾端几乎透明 */
function drawTrail(f: Flight, head: number, alpha: number) {
  if (!ctx || alpha <= 0 || head <= 0) return;
  const steps = 24;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(110, 240, 160, 0.9)';
  ctx.shadowBlur = 12;
  for (let i = 0; i < steps; i++) {
    const a = head * (i / steps);
    const b = head * ((i + 1) / steps);
    const k = (i + 1) / steps;
    const strength = Math.pow(k, 1.7);
    const p0 = bezier(f, a);
    const p1 = bezier(f, b);

    // 外层柔光：宽而淡，形成「光带」的体积
    ctx.strokeStyle = `rgba(92, 224, 144, ${(alpha * 0.16 * strength).toFixed(3)})`;
    ctx.lineWidth = 6 + 13 * k;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    // 内层亮芯：靠近光团更亮更粗，尾端渐隐
    ctx.strokeStyle = `rgba(188, 255, 212, ${(alpha * (0.05 + 0.85 * strength)).toFixed(3)})`;
    ctx.lineWidth = 0.8 + 4 * k;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

function loop(now: number) {
  if (ctx) ctx.clearRect(0, 0, cssW, cssH);

  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    if (f.phase === 'fly') {
      const raw = Math.min(1, (now - f.startedAt) / f.duration);
      f.progress = ease(raw);
      const p = bezier(f, f.progress);
      f.orb.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      drawTrail(f, f.progress, 1);
      if (raw >= 1) {
        f.progress = 1;
        f.phase = 'fade';
        f.fadeAt = now;
      }
    } else {
      const k = (now - f.fadeAt) / f.fadeMs;
      const alpha = Math.max(0, 1 - k);
      drawTrail(f, 1, alpha);
      f.orb.el.style.opacity = String(alpha);
      if (k >= 1) {
        f.orb.el.remove();
        const idx = f.orb.frame.orbs.indexOf(f.orb);
        if (idx >= 0) f.orb.frame.orbs.splice(idx, 1);
        fillOrbs(f.orb.frame);
        flights.splice(i, 1);
      }
    }
  }

  if (flights.length) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = 0;
    if (ctx) ctx.clearRect(0, 0, cssW, cssH);
  }
}

/** fast：点击会导航的链接时缩短时长，让动画播完再跳页 */
function launch(frame: Frame, fast: boolean) {
  if (reduced || flights.length >= MAX_FLIGHTS) return;
  const pool = frame.orbs.filter((o) => !o.flying);
  const count = Math.min(pool.length, Math.random() < 0.62 ? 2 : 1);

  for (let i = 0; i < count; i++) {
    const orb = pool[i];
    const target = pickTarget(frame);
    const to = target ? targetPoint(target) : null;
    if (!to) break;

    const from = orb.home;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(170, 45 + dist * 0.2);
    const ctrl = {
      x: (from.x + to.x) / 2 - (dy / dist) * bend,
      y: (from.y + to.y) / 2 + (dx / dist) * bend,
    };

    orb.flying = true;
    orb.el.classList.add('is-flying');
    flights.push({
      orb,
      from,
      to,
      ctrl,
      startedAt: performance.now(),
      duration: fast ? 500 : 860,
      fadeMs: fast ? 520 : 900,
      progress: 0,
      phase: 'fly',
      fadeAt: 0,
    });
  }

  if (flights.length && !raf) raf = requestAnimationFrame(loop);
}

resizeCanvas();
buildFrames();

if (!reduced) {
  // 卡片 / 标签都在链接里：稍等动画播完再跳页，否则看不到飞行与光带
  document.addEventListener(
    'click',
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const node = event.target;
      if (!(node instanceof Element)) return;
      const frameEl = node.closest(SELECTOR) as HTMLElement | null;
      const frame = frameEl ? frameMap.get(frameEl) : undefined;
      if (!frame) return;

      let fast = false;
      const link = node.closest('a[href]') as HTMLAnchorElement | null;
      if (link) {
        let url: URL;
        try {
          url = new URL(link.getAttribute('href') || '', location.href);
        } catch {
          return;
        }
        const plainNav =
          url.origin === location.origin &&
          url.pathname !== location.pathname &&
          !url.hash &&
          link.target !== '_blank' &&
          !link.hasAttribute('download');
        if (plainNav) {
          event.preventDefault();
          fast = true;
          window.clearTimeout(navTimer);
          const href = url.href;
          navTimer = window.setTimeout(() => window.location.assign(href), 820);
        }
      }
      launch(frame, fast);
    },
    true,
  );
}

window.addEventListener('load', () => {
  resizeCanvas();
  repositionOrbs();
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeCanvas();
    repositionOrbs();
  }, 120);
});

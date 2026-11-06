/**
 * 荧光团（全局交互）
 * - 在卡片 / 标签组 / 筛选框等「框」的边缘常驻朦胧光团，像呼吸一样渐明渐暗
 * - 点击框时，1~2 个光团沿随机曲线飞向另一个随机框，拖出朦胧光雾轨迹，随后缓缓淡出
 * - 光团：白芯 → 黄绿 → 四叶草荧光绿 → 化进背景，全程无硬边
 * - 密集标签按「组」计一个框，并做最小间距限制，避免一堆小框挤满光点
 *
 * 整层用文档坐标（absolute 定位在 body 起点），滚动时无需重算位置。
 */

const SELECTOR =
  '.card, .art-card, .card-tags, .tags, .chips, .btn, .filter, .facts, .hero-media, .shots';

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
  c1: Point;
  c2: Point;
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
const MIN_GAP = 62;

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
  const off = 6;
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

/** 相邻小框不再各挂一个光点，保持画面稀疏 */
function tooClose(p: Point): boolean {
  for (const frame of frames) {
    for (const orb of frame.orbs) {
      if (Math.hypot(orb.home.x - p.x, orb.home.y - p.y) < MIN_GAP) return true;
    }
  }
  return false;
}

function spawnOrb(frame: Frame): boolean {
  const rect = docRect(frame.el);
  if (!rect) return false;

  // 最多换 4 个边位置找一个不与已有光团挤在一起的点
  for (let attempt = 0; attempt < 4; attempt++) {
    const edge = randomEdge();
    const t = 0.16 + Math.random() * 0.68;
    const home = pointAt(rect, edge, t);
    if (tooClose(home)) continue;

    const size = frame.kind === 'small' ? 20 + Math.random() * 6 : 28 + Math.random() * 8;
    const el = document.createElement('div');
    el.className = 'firefly';
    el.style.setProperty('--orb', `${size.toFixed(1)}px`);
    el.style.setProperty('--dur', `${(4.2 + Math.random() * 2.6).toFixed(2)}s`);
    el.style.setProperty('--delay', `${(-Math.random() * 6).toFixed(2)}s`);
    el.style.transform = `translate(${home.x}px, ${home.y}px)`;
    const dot = document.createElement('span');
    dot.className = 'firefly-dot';
    el.appendChild(dot);
    layer.appendChild(el);

    frame.orbs.push({ el, frame, edge, t, home, flying: false });
    return true;
  }
  return false;
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
    // 一整组标签只算一个框，不再给每个 tag / chip 单独挂光团
    const kind: Kind = el.matches('.card-tags, .tags, .chips, .btn')
      ? 'small'
      : el.matches('.card, .art-card')
        ? 'card'
        : 'panel';
    const frame: Frame = { el, kind, desired: kind === 'card' ? 2 : 1, orbs: [] };
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

/** 落点也完全随机：目标框的任意一条边、任意位置 */
function targetPoint(frame: Frame): Point | null {
  const rect = docRect(frame.el);
  return rect ? pointAt(rect, randomEdge(), 0.12 + Math.random() * 0.76) : null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 三次贝塞尔：两个随机控制点让每次飞行路径都不一样 */
function bezier(f: Flight, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * f.from.x + b * f.c1.x + c * f.c2.x + d * f.to.x,
    y: a * f.from.y + b * f.c1.y + c * f.c2.y + d * f.to.y,
  };
}

/** 三层宽柔光叠加，配合 canvas 的整体模糊，只留下朦胧光雾，没有清晰亮线 */
function drawTrail(f: Flight, head: number, alpha: number) {
  if (!ctx || alpha <= 0 || head <= 0) return;
  const steps = 26;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(190, 255, 110, 0.5)';
  ctx.shadowBlur = 20;
  for (let i = 0; i < steps; i++) {
    const t0 = head * (i / steps);
    const t1 = head * ((i + 1) / steps);
    const k = (i + 1) / steps;
    const strength = Math.pow(k, 1.5);
    const p0 = bezier(f, t0);
    const p1 = bezier(f, t1);

    const layers: Array<[string, number]> = [
      [`rgba(92, 224, 144, ${(alpha * 0.1 * strength).toFixed(3)})`, 30 + 16 * k],
      [`rgba(190, 245, 96, ${(alpha * 0.19 * strength).toFixed(3)})`, 15 + 10 * k],
      [`rgba(246, 255, 196, ${(alpha * 0.22 * strength).toFixed(3)})`, 6 + 6 * k],
    ];
    for (const [color, width] of layers) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
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
    const nx = -dy / dist;
    const ny = dx / dist;
    const jitter = () => (Math.random() - 0.5) * Math.min(90, dist * 0.2);
    const bend1 =
      (Math.random() < 0.5 ? -1 : 1) * Math.min(240, 60 + dist * (0.18 + Math.random() * 0.32));
    const bend2 =
      (Math.random() < 0.5 ? -1 : 1) * Math.min(200, 40 + dist * (0.12 + Math.random() * 0.28));
    const c1 = {
      x: from.x + dx * 0.3 + nx * bend1 + jitter(),
      y: from.y + dy * 0.3 + ny * bend1 + jitter(),
    };
    const c2 = {
      x: from.x + dx * 0.7 + nx * bend2 + jitter(),
      y: from.y + dy * 0.7 + ny * bend2 + jitter(),
    };

    orb.flying = true;
    orb.el.classList.add('is-flying');
    flights.push({
      orb,
      from,
      to,
      c1,
      c2,
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

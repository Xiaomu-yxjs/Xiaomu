/**
 * 环境荧光团（全屏缓慢漂浮）
 * - 光团不再附着于卡片 / 标签等「框」，而是自由分布在整屏（视口固定）
 * - 极缓慢地漂移 + 低频游走，靠近边缘时缓缓转身，不做瞬移
 * - 每个光团带一大圈极淡的柔光，微微照亮周围的背景与卡片
 * - 像呼吸一样渐明渐暗；prefers-reduced-motion 下静止
 * - 不再有点击飞行、不再绘制任何轨迹，彻底避免断续光带
 */

interface Orb {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  turn: number;
  speed: number;
  phase: number;
  halo: number;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const layer = document.createElement('div');
layer.className = 'firefly-layer';
layer.setAttribute('aria-hidden', 'true');
document.body.appendChild(layer);

const orbs: Orb[] = [];
let vw = window.innerWidth;
let vh = window.innerHeight;
let last = 0;
let raf = 0;
let resizeTimer = 0;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** 屏幕越大光团越多，但始终保持稀疏、不喧宾夺主 */
function desiredCount(): number {
  return Math.max(9, Math.min(24, Math.round((vw * vh) / 62000)));
}

function place(o: Orb) {
  o.el.style.transform = `translate3d(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px, 0)`;
}

function createOrb(): Orb {
  const halo = rand(95, 175);
  const el = document.createElement('div');
  el.className = 'firefly';
  el.style.setProperty('--halo', `${(halo * 2).toFixed(0)}px`);
  el.style.setProperty('--orb', `${rand(15, 25).toFixed(1)}px`);
  el.style.setProperty('--dur', `${rand(4.8, 9.2).toFixed(2)}s`);
  el.style.setProperty('--delay', `${(-rand(0, 9)).toFixed(2)}s`);

  const glow = document.createElement('span');
  glow.className = 'firefly-glow';
  const dot = document.createElement('span');
  dot.className = 'firefly-dot';
  el.append(glow, dot);
  layer.appendChild(el);

  // 起始位置做一点最小间距，避免刚加载就挤成一堆
  let x = rand(0, vw);
  let y = rand(0, vh);
  for (let i = 0; i < 12; i++) {
    if (orbs.every((o) => Math.hypot(o.x - x, o.y - y) > 90)) break;
    x = rand(0, vw);
    y = rand(0, vh);
  }

  // 每秒只走 2.5~7 像素，属于「很缓慢」的漂浮
  const speed = rand(2.5, 7);
  const angle = rand(0, Math.PI * 2);
  const orb: Orb = {
    el,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    turn: rand(-0.03, 0.03),
    speed,
    phase: rand(0, Math.PI * 2),
    halo,
  };
  place(orb);
  return orb;
}

function sync() {
  const want = desiredCount();
  while (orbs.length < want) orbs.push(createOrb());
  while (orbs.length > want) orbs.pop()?.el.remove();
}

function tick(now: number) {
  raf = 0;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const pad = Math.max(70, Math.min(vw, vh) * 0.14);

  for (const o of orbs) {
    // 低频游走：方向极慢地变化，路径自然、不重复、不会突然拐弯
    o.angle += (o.turn + Math.sin(now / 12000 + o.phase) * 0.02) * dt;
    o.vx = Math.cos(o.angle) * o.speed;
    o.vy = Math.sin(o.angle) * o.speed;

    // 靠近屏幕边缘时加一点向内的力，缓缓转身，不做瞬移
    let ax = 0;
    let ay = 0;
    if (o.x < pad) ax += (1 - o.x / pad) * 9;
    if (o.x > vw - pad) ax -= (1 - (vw - o.x) / pad) * 9;
    if (o.y < pad) ay += (1 - o.y / pad) * 9;
    if (o.y > vh - pad) ay -= (1 - (vh - o.y) / pad) * 9;
    if (ax || ay) {
      o.vx += ax * dt;
      o.vy += ay * dt;
      const mag = Math.hypot(o.vx, o.vy);
      if (mag > 0.0001) {
        o.vx = (o.vx / mag) * o.speed;
        o.vy = (o.vy / mag) * o.speed;
        o.angle = Math.atan2(o.vy, o.vx);
      } else {
        o.vx = o.speed;
        o.vy = 0;
        o.angle = 0;
      }
    }

    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.x = Math.max(-o.halo, Math.min(vw + o.halo, o.x));
    o.y = Math.max(-o.halo, Math.min(vh + o.halo, o.y));
    place(o);
  }

  if (!document.hidden) raf = requestAnimationFrame(tick);
}

function start() {
  if (reduced || raf || document.hidden) return;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

sync();
start();

// 切到后台时停掉 rAF，回来再续上，避免累积一大步位移
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  } else {
    start();
  }
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    sync();
    for (const o of orbs) {
      o.x = Math.max(0, Math.min(vw, o.x));
      o.y = Math.max(0, Math.min(vh, o.y));
      place(o);
    }
  }, 160);
});

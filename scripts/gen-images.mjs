/**
 * 生成占位封面 / 截图（抽象几何艺术，不含任何真实产品素材）
 * 用法：npm run images
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const games = JSON.parse(fs.readFileSync(path.join(root, 'src/data/games.json'), 'utf8'));

const PALETTE = {
  角色扮演: ['#1b1145', '#3b2a7a', '#7c5cff'],
  策略: ['#0f2a2e', '#14454a', '#34d3c4'],
  模拟经营: ['#3a2a12', '#7a5522', '#f0b445'],
  竞速: ['#2a0f12', '#6b1a22', '#ff5b4d'],
  冒险解谜: ['#06131f', '#0b2a42', '#4fb3ff'],
  射击: ['#2b0d05', '#5c1f0a', '#ff7a2f'],
};

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function base(w, h, [c1, c2, c3], rnd) {
  const blobs = Array.from({ length: 4 }, (_, i) => {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = (0.25 + rnd() * 0.5) * Math.max(w, h);
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#b${i})" opacity="${(0.35 + rnd() * 0.4).toFixed(2)}"/>`;
  }).join('');

  const defs = Array.from({ length: 4 }, (_, i) => {
    const cx = (rnd() * 100).toFixed(0);
    const cy = (rnd() * 100).toFixed(0);
    return `<radialGradient id="b${i}" cx="${cx}%" cy="${cy}%" r="60%">
      <stop offset="0%" stop-color="${i % 2 ? c3 : '#ffffff'}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>`;
  }).join('');

  // 斜向细线纹理
  const lines = Array.from({ length: 26 }, (_, i) => {
    const x = -h + i * (w + h) / 26;
    return `<line x1="${x}" y1="0" x2="${x + h}" y2="${h}" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>`;
  }).join('');

  // 几何多边形
  const poly = () => {
    const n = 3 + Math.floor(rnd() * 3);
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = (0.12 + rnd() * 0.3) * Math.min(w, h) * 2;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
      const rr = r * (0.6 + rnd() * 0.5);
      return `${(cx + Math.cos(a) * rr).toFixed(0)},${(cy + Math.sin(a) * rr).toFixed(0)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${c3}" opacity="${(0.1 + rnd() * 0.16).toFixed(2)}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>`;
  };

  return { defs, body: lines + blobs + poly() + poly() };
}

function coverSvg(game) {
  const w = 1200, h = 500;
  const c = PALETTE[game.category] ?? ['#101216', '#2a2d36', '#8b8f9a'];
  const rnd = rand(hash(game.slug));
  const { defs, body } = base(w, h, c, rnd);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c[0]}"/><stop offset="100%" stop-color="${c[1]}"/>
      </linearGradient>
      ${defs}
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="55%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${body}
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
  </svg>`;
}

function shotSvg(game, n) {
  const w = 1280, h = 720;
  const c = PALETTE[game.category] ?? ['#101216', '#2a2d36', '#8b8f9a'];
  const rnd = rand(hash(game.slug + n));
  const { defs, body } = base(w, h, c, rnd);
  // 模拟游戏 HUD 元素
  const hud = `
    <g opacity="0.85">
      <rect x="56" y="48" width="240" height="14" rx="7" fill="#ffffff" fill-opacity="0.22"/>
      <rect x="56" y="48" width="${(120 + rnd() * 110).toFixed(0)}" height="14" rx="7" fill="${c[2]}" fill-opacity="0.9"/>
      <rect x="56" y="76" width="150" height="10" rx="5" fill="#ffffff" fill-opacity="0.14"/>
      <rect x="${w - 296}" y="48" width="240" height="56" rx="12" fill="#000000" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.14"/>
      <circle cx="1024" cy="76" r="16" fill="${c[2]}" fill-opacity="0.8"/>
      <rect x="1056" y="66" width="140" height="8" rx="4" fill="#ffffff" fill-opacity="0.3"/>
      <rect x="1056" y="82" width="86" height="8" rx="4" fill="#ffffff" fill-opacity="0.18"/>
      <circle cx="150" cy="${h - 150}" r="62" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
      <circle cx="150" cy="${h - 150}" r="26" fill="#ffffff" fill-opacity="0.14"/>
      <circle cx="${w - 150}" cy="${h - 150}" r="44" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.18"/>
      <rect x="${w / 2 - 140}" y="${h - 76}" width="280" height="16" rx="8" fill="#000000" fill-opacity="0.25"/>
      <rect x="${w / 2 - 140}" y="${h - 76}" width="120" height="16" rx="8" fill="${c[2]}" fill-opacity="0.75"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c[0]}"/><stop offset="100%" stop-color="${c[1]}"/>
      </linearGradient>
      ${defs}
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${body}
    ${hud}
    <rect width="${w}" height="${h}" fill="none" stroke="#000000" stroke-opacity="0.25"/>
  </svg>`;
}

const coverDir = path.join(root, 'src/assets/covers');
const shotDir = path.join(root, 'src/assets/shots');
fs.mkdirSync(coverDir, { recursive: true });
fs.mkdirSync(shotDir, { recursive: true });

let count = 0;
for (const game of games) {
  await sharp(Buffer.from(coverSvg(game))).jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(coverDir, `${game.cover}.jpg`));
  count++;
  for (const shot of game.screenshots ?? []) {
    await sharp(Buffer.from(shotSvg(game, shot))).jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(shotDir, `${shot}.jpg`));
    count++;
  }
  console.log(`✓ ${game.slug}  封面 + ${game.screenshots?.length ?? 0} 张截图`);
}
// 站点默认分享图（OG image），社交平台不认 SVG，所以出 jpg
const ogGame = { slug: 'pixel-notes-og', category: '角色扮演' };
fs.mkdirSync(path.join(root, 'public/images'), { recursive: true });
await sharp(Buffer.from(coverSvg({ ...ogGame, slug: 'pixel-notes-og' })))
  .resize(1200, 630)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path.join(root, 'public/images/og-default.jpg'));
console.log('✓ og-default.jpg (1200×630)');

console.log(`\n共生成 ${count} 张占位图`);

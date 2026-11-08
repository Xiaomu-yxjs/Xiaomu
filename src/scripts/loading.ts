/**
 * 加载体验（符合主题的四叶草动画）
 *
 * 1) 图片占位：凡是还没加载完的图片，先显示一枚会呼吸的四叶草，
 *    load / error 后淡入真实图片。冷缓存或慢网下不会再出现空白方块。
 * 2) 站内跳转预加载：点站内链接时后台先把目标页 HTML 和首屏图片取回来，
 *    超过 120ms 才盖一层旋转四叶草，取完（或 2.2s 超时）再跳过去，
 *    这样点进详情页不会先看到一片没图的空页面。
 * 3) 鼠标悬停 / 键盘聚焦时用 <link rel=prefetch> 提前取 HTML，点击时命中缓存。
 *
 * 所有预取都在当前主题背景与首屏图片之后进行，不抢占首屏带宽。
 */

/* ---------------- 1. 图片占位 ---------------- */

function watchImage(img: HTMLImageElement) {
  if (img.dataset.cloverImg) return;
  img.dataset.cloverImg = '1';
  // complete 为 true 说明已经结束（成功或失败），不需要占位动画
  if (img.complete) return;

  img.classList.add('img-loading');
  const done = () => {
    if (!img.classList.contains('img-loading')) return;
    img.classList.remove('img-loading');
    img.classList.add('img-ready');
  };
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
}

function scan(node: ParentNode) {
  node.querySelectorAll('img').forEach((img) => watchImage(img as HTMLImageElement));
}

scan(document);

// 动态插入的图片（例如后续可能新增的卡片）也能拿到占位
const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof HTMLImageElement) watchImage(node);
      else if (node instanceof Element) scan(node);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

/* ---------------- 2. 站内跳转预加载 ---------------- */

const loader = document.getElementById('clover-loader');
const showLoader = () => loader?.classList.add('is-active');
const hideLoader = () => loader?.classList.remove('is-active');

// 从 bfcache 返回时不要把加载层留在屏幕上
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) hideLoader();
});

/** 只接管真正的站内页面跳转；外链、锚点、下载、新窗口一律走浏览器原生行为 */
function internalUrl(link: HTMLAnchorElement): URL | null {
  const raw = link.getAttribute('href');
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return null;
  if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
  const url = new URL(link.href, location.href);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== location.origin) return null;
  // 同一页面的锚点或重复链接不拦截
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return url;
}

function linkFrom(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest('a') : null;
}

function decodeImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });
}

/** 取目标页 HTML，并把首屏几张图提前下载解码，跳转后就能直接命中缓存 */
async function warmPage(href: string) {
  const res = await fetch(href, { credentials: 'same-origin' });
  if (!res.ok) return;
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const urls = new Set<string>();
  doc.querySelectorAll('main img').forEach((img, i) => {
    if (i >= 6) return;
    const src = img.getAttribute('src');
    if (src) urls.add(new URL(src, href).href);
  });
  await Promise.allSettled([...urls].map(decodeImage));
}

let navigating = false;

document.addEventListener('click', (e) => {
  if (navigating || e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = linkFrom(e.target);
  if (!link) return;
  const url = internalUrl(link);
  if (!url) return;

  e.preventDefault();
  navigating = true;

  // 预取很快时不显示加载层，避免闪一下；慢时才给反馈
  const showTimer = window.setTimeout(showLoader, 120);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 2200));

  Promise.race([warmPage(url.href).catch(() => {}), timeout]).then(() => {
    window.clearTimeout(showTimer);
    location.assign(url.href);
  });
});

/* ---------------- 3. 悬停 / 聚焦预取 ---------------- */

const prefetched = new Set<string>();
function prefetchHtml(href: string) {
  if (prefetched.has(href)) return;
  prefetched.add(href);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'document';
  link.href = href;
  document.head.appendChild(link);
}

function onHint(e: Event) {
  const link = linkFrom(e.target);
  if (!link) return;
  const url = internalUrl(link);
  if (url) prefetchHtml(url.href);
}

document.addEventListener('pointerover', onHint, { passive: true });
document.addEventListener('focusin', onHint);

// 移动端没有 hover：页面完全加载后，趁浏览器空闲把主要站内页面的 HTML 也备好。
// 放在 load + idle 之后，绝不和首屏背景 / 封面抢带宽。
function prefetchMainLinks() {
  const links = document.querySelectorAll<HTMLAnchorElement>('main a[href]');
  let taken = 0;
  for (const a of links) {
    if (taken >= 4) break;
    const url = internalUrl(a);
    if (!url || prefetched.has(url.href)) continue;
    prefetched.add(url.href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = url.href;
    document.head.appendChild(link);
    taken++;
  }
}

function scheduleIdlePrefetch() {
  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (idle) idle.call(window, prefetchMainLinks, { timeout: 4000 });
  else window.setTimeout(prefetchMainLinks, 2500);
}

if (document.readyState === 'complete') scheduleIdlePrefetch();
else window.addEventListener('load', scheduleIdlePrefetch, { once: true });

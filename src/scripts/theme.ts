/**
 * 日间 / 夜间主题切换
 * - 默认夜间（当前暗绿发光主题）；选择记在 localStorage，刷新不回退
 * - 初始主题由 BaseLayout <head> 里的内联脚本在解析阶段设置，不会闪一下夜间
 * - 切换时广播 clover:theme，让荧光团脚本在日间完全停掉
 */
type Theme = 'night' | 'day';

const KEY = 'clover-theme';
const root = document.documentElement;
const btn = document.getElementById('theme-toggle') as HTMLButtonElement | null;
const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

const current = (): Theme => (root.dataset.theme === 'day' ? 'day' : 'night');

function syncLabel(theme: Theme) {
  if (!btn) return;
  const label = theme === 'day' ? '切换到夜间模式' : '切换到日间模式';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}

function apply(theme: Theme) {
  root.dataset.theme = theme;
  if (meta) meta.content = theme === 'day' ? '#3f7d2a' : '#0a2417';
  syncLabel(theme);
  window.dispatchEvent(new CustomEvent('clover:theme', { detail: { theme } }));
}

syncLabel(current());

btn?.addEventListener('click', () => {
  const next: Theme = current() === 'day' ? 'night' : 'day';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // 隐私模式下 localStorage 可能不可写，本次会话仍然正常切换
  }
  apply(next);
});

// 其它标签页改了主题时同步过来（不写回 localStorage，避免循环）
window.addEventListener('storage', (e) => {
  if (e.key === KEY && (e.newValue === 'day' || e.newValue === 'night')) apply(e.newValue);
});

// 另一套背景不参与首屏：以前在 idle 就预取，导致日夜两张图（约 194 KB）
// 在首屏一起下载。改成「用户明确要切换」或「首屏全部加载完之后」才备图。
let otherBgReady = false;
function prefetchOtherBg() {
  if (otherBgReady) return;
  otherBgReady = true;
  const url = current() === 'day' ? document.body.dataset.bgNight : document.body.dataset.bgDay;
  if (!url) return;
  const img = new Image();
  img.src = url;
}

// 指针移到 / 聚焦 / 按下主题按钮时立即备图，点击时基本已命中缓存
btn?.addEventListener('pointerenter', prefetchOtherBg, { once: true });
btn?.addEventListener('pointerdown', prefetchOtherBg, { once: true });
btn?.addEventListener('focus', prefetchOtherBg, { once: true });

// 兜底：等 load（首屏图片全部到位）之后再等一会儿，彻底避开首屏带宽
function scheduleBgPrefetch() {
  window.setTimeout(prefetchOtherBg, 15000);
}
if (document.readyState === 'complete') scheduleBgPrefetch();
else window.addEventListener('load', scheduleBgPrefetch, { once: true });

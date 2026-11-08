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

// 浏览器空闲时才预取另一套背景，切换时不必等网络；不占首屏带宽
function prefetchOtherBg() {
  const url = current() === 'day' ? document.body.dataset.bgNight : document.body.dataset.bgDay;
  if (!url) return;
  const img = new Image();
  img.src = url;
}
const idle = (window as unknown as {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
}).requestIdleCallback;
if (idle) idle.call(window, prefetchOtherBg, { timeout: 4000 });
else window.setTimeout(prefetchOtherBg, 2500);

/**
 * 配合 astro.config.mjs 里的 base: '/Xiaomu/' 使用。
 * Astro 只会自动改写它自己管理的 /_astro/ 资源；我们手写的 <a href="/...">
 * 必须显式加前缀，否则在 GitHub Pages 项目页子路径下会 404。
 * import.meta.env.BASE_URL 在构建时被替换为 base 值（带结尾斜杠）。
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = base.endsWith('/') ? base.slice(0, -1) : base;
  if (!path.startsWith('/')) path = '/' + path;
  return clean + path;
}

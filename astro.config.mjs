import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 项目页：site 用仓库页根地址，base 必须带 /仓库名/ 前缀
export default defineConfig({
  site: 'https://xiaomu-yxjs.github.io/Xiaomu',
  base: '/Xiaomu/',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap()],
  image: {
    // 默认即 sharp，显式声明避免不同环境降级到 passthrough
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  compressHTML: true,
});

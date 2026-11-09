# 苜蓿草 · 手游测评站

按《游戏网站 AI 提示词库》落地的一套可运行站点：Astro 静态站 + JSON 数据驱动，零服务器成本，部署在 GitHub Pages。

> 站内只收录**真实游戏**（共 6 款）：机战：钢铁巨舰、决战破晓、墨香情、武林外传：十年之约、龙之谷启程、桃园：将帅录。封面、玩法截图、图标与下载链接均取自 3975（三九互娱 / 39 游戏官网）及各游戏官方站：`https://<子域>.3975.com/download/sao`。评分统一在 8.0 以上，未在数据中指定的按 slug 稳定生成，不显示「待定」，也不编造人数、价格等未公开信息。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产物在 dist/，应为 0 error
npm run preview  # 本地预览构建产物
```

Node 版本要求：`>=22.23.4` 对应 Astro 7；本项目锁定 **Astro 5.18**，Node 18.17+ / 22.x 都能跑（本机 22.22.2 已验证）。

## 目录结构

```
src/
├─ data/games.json         # 唯一数据源，改这里就够
├─ assets/covers/*.jpg     # 官方封面 / 主视觉
├─ assets/shots/*.jpg      # 官方游戏截图
├─ assets/icons/*.png      # 官方方形 App 图标
├─ lib/games.ts            # 类型 + picks / categories / 评分格式化与随机生成
├─ lib/images.ts           # glob 解析图片 → ImageMetadata，交给 <Image> 优化
├─ styles/global.css       # design tokens，单点定义
├─ components/
│  ├─ SiteHeader.astro
│  ├─ SiteFooter.astro     # 含数据免责声明
│  ├─ PickCard.astro       # 首页精选（扁横幅 + 2 行截断）
│  └─ GameCard.astro       # 游戏库卡片（带 data-* 供前端筛选）
├─ layouts/BaseLayout.astro # title/description/canonical/OG 全在这里
└─ pages/
   ├─ index.astro          # 首页：Hero + 精品推荐 + 最近测评
   ├─ library.astro        # 游戏库：纯前端筛选（类别/标记/关键词 + URL 同步 + 下滑收起筛选条）
   ├─ me.astro             # 个人主页：登录占位（即将开放）+ 收藏 / 浏览占位
   ├─ games/[slug].astro   # 详情页：双栏 + 截图画廊 + JSON-LD VideoGame
   └─ 404.astro
```

## 加一款游戏（3 步）

1. 在 `src/data/games.json` 追加一条记录（字段见下）。
2. 从游戏官网取素材，按 `cover` / `icon` / `screenshots` 里的文件名放进 `src/assets/{covers,icons,shots}/`。封面与截图用 `.jpg`，图标支持 `.png` / `.jpg`。
3. `npm run build`。详情页 `/games/<slug>/`、首页、游戏库、sitemap 全部自动更新。

> 缺失的截图会被跳过、图标会自动隐藏；但 `cover` 必须有对应文件，否则构建报错。

### 数据字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | ✅ | 内部唯一 ID |
| `slug` | string | ✅ | URL 片段，同时是图片文件名 |
| `title` | string | ✅ | 游戏名 |
| `category` | string | ✅ | 决定筛选分类 |
| `badge` | `pick` \| `new` \| `hot` | ✅ | `pick` 会进首页精品推荐（最多 3 款） |
| `cover` | string | ✅ | 封面文件名（不含扩展名） |
| `icon` | string |  | 方形 App 图标文件名，缺省时卡片与详情页不显示图标 |
| `description` | string | ✅ | 简介，卡片上 2 行截断，详情页全文 |
| `platform` | string[] | ✅ | 如 `["Android","iOS","PC"]` |
| `tags` | string[] | ✅ | 玩法标签，卡片取前 3 |
| `rating` | number | ✅ | 评分，统一在 8.0 以上；缺填或低于 8.0 时 `lib/games.ts` 按 slug 随机生成 8.1~9.8 |
| `externalUrl` | string | ✅ | 官方下载外链，`rel="nofollow noopener"` |
| `screenshots` | string[] | ✅ | 空数组时详情页整段画廊自动隐藏 |

> 不展示在玩人数、价格与「免费」字样，也不再提供微信小程序入口；`players` / `price` / `originalPrice` 字段已从 schema 移除。

## 设计约定

- **卡片用线不用阴影**：`1px solid var(--line)`，hover 时 `translateY(-3px)` + 封面 `scale(1.04)`，无 box-shadow。
- **断点**：360 / 768 / 1280；网格 3 列 → 2 列 → 1 列。
- **图片**：全部走 `astro:assets`，构建时转 WebP 并按 `widths` 出多档 srcset。
- **无 JS 也能用**：除筛选外，全部静态可读。
- **日间 / 夜间主题**：右上角的切换按钮默认夜间（暗绿发光背景 + 荧光团），点一下切到日间（明亮四叶草草地背景、无荧光团）。选择存在 `localStorage['clover-theme']`，`<head>` 内联脚本在解析阶段就写好 `<html data-theme>`，刷新不回退也不会闪；`src/scripts/theme.ts` 广播 `clover:theme` 让荧光团脚本启停。日间保留深色玻璃卡片与浅色文字，靠文字暗影和首屏左侧暗渐变保证亮草地上的可读性。
- 游戏库筛选项由当前数据动态生成，不会出现点了必定零结果的类别 / 标记。
- **筛选条下滑收起**（仅 ≥960px，即 sticky 生效时）：桌面端往下滚动约 12px，大筛选面板就收成一条 42px 的「搜索 / 筛选」细条，避免半透明面板一直盖住卡片；细条上同步显示当前条件摘要与结果数，点击细条即展开（**不自动聚焦搜索框**），滚回页面顶部也会自动展开。展开后再次下滑仍会收起：展开时同步重置滚动锚点，且只有「刚输入过 1.2 秒内」才暂缓收起，单纯焦点停在输入框不再让收起永久失效；游戏库页面较短（桌面可滚约 400px），原来的 80px 阈值会让二次收起看起来完全失效，故改为 12px。收起态用 `visibility: hidden` 保留占位高度 + `inert` 屏蔽焦点，卡片位置与滚动位置都不跳动；收起后不会因上滑自动弹回。移动端不启用，避免留下大片空白。**收起是原子切换**：主体 `visibility:hidden` + `opacity:0`、细条同一帧 `display:flex`，细条没有入场动画、chip 不用 `transition: all`，放大镜图标、搜索框、标签一起消失，滚动中不会再出现「细条已出现、标签还留着」的叠影；面板也去掉了 `backdrop-filter`，少一层实时模糊合成。
- **个人主页 / 登录占位**：左上角四叶草标识指向 `/me/`（导航里的「首页」仍回首页，避免重复入口），页面 `noindex` 且由 `astro.config.mjs` 的 sitemap `filter` 排除。按用户选择「先只做页面」：`登录 / 注册` 按钮 `disabled` 并标「即将开放」，另有「我的收藏 / 最近浏览」占位骨架；**未接入后端，也没有做本地演示登录**，账号功能待定。
- **环境荧光团**：`src/scripts/fireflies.ts` 全局注入。光团是「白芯 → 黄绿 → 荧光绿」的朦胧光球，像呼吸一样渐明渐暗；不附着任何卡片 / 标签框，而是固定在视口内、以每秒约 2.5~7px 极缓慢地随机漂移，靠近屏幕边缘会缓缓转身。每个光团带一圈大范围极淡柔光，微微照亮周围。没有点击飞行动画、也不绘制任何轨迹（避免断续光带），点击卡片链接不再延迟跳转。`prefers-reduced-motion` 下静止；切到后台暂停动画；**切到日间模式时整层隐藏、光团节点清空并停掉 rAF**，只有夜间才会出现。
- **光团性能**：光团不是实时 `radial-gradient`，而是 `public/images/firefly.webp` 的预渲染位图（约 4KB，另有 `firefly.png` 无损母版），浏览器只需贴图合成；位移更新节流到约 30fps；数量按视口面积限制在 8~14 个。原先 21 个渐变 + `mix-blend-mode: screen` 每帧要与整页重新混合，是滚动掉帧的主因。滚动期间连漂移 rAF 与呼吸动画一起暂停，滚动停止 180ms 后续上。
- **加载体验**（`src/scripts/loading.ts`）：未加载完的图片先显示会呼吸的绿色四叶草占位，`load` / `error` 后淡入真实图片；点站内链接时后台预取目标页 HTML 并解码首屏前 6 张图，超过 120ms 才盖一层旋转四叶草加载层，取完或 2.2s 超时再跳转，避免「点进去一片空白等图」。鼠标悬停 / 键盘聚焦 / 页面 load 后空闲时还会预取主要站内页 HTML（最多 4 个），移动端没有 hover 也能受益。外链、锚点、下载、新窗口一律不拦截。

## 性能约定

- **背景图**：夜间 `public/images/site-bg.webp`（1600×899，约 54KB），日间 `public/images/site-bg-day.webp`（1600×901，约 143KB）。`BaseLayout.astro` 的 head 内联脚本按当前主题动态插入 `<link rel="preload" as="image" fetchpriority="high">`，只预载会用到的那张，不等 CSS 下载；另一张在浏览器空闲时才预取，不占首屏带宽。`global.css` 的第三层背景分别内联了夜间 84 字节、日间 196 字节的模糊占位图，高清图未到达或刚切换主题时不会空白。`public/images/site-bg.jpg` 保留为夜间原始母版。
- **背景晃动**：`BaseLayout.astro` 里背景单独成层（`.clover-bg` 固定视口 + `.clover-bg-art` 比视口大 4%），夜间 30s、日间 36s 的 `clover-sway` 关键帧只改 `transform`（位移约 1%、缩放 1.055→1.062、微旋 ±0.14deg），像草地被风轻轻推了一下。只动画 transform 且层已 `will-change`，由合成线程完成；同时去掉了原来的 `background-attachment: fixed`（滚动时每帧重绘整屏背景的主因），滚动实测平均帧间隔 16.7ms、0 掉帧。`prefers-reduced-motion` 下背景静止。
- **图片加载**：首页只有 3 张 hero 叠层封面用 `loading="eager"`，第一张 `fetchpriority="high"`、其余 `low`；卡片封面/图标与画廊均按需加载；详情页首屏封面 `fetchpriority="high"`、画廊 `low`。首页三处封面共用同一组 `widths={[400, 800, 1200]}`，让同一张封面生成相同 URL、浏览器只下载一次。所有预取都排在首屏之后，不抢背景与封面的带宽。
- **实测基线**（Fast 3G 1.6Mbps / 150ms RTT，冷缓存，1440×900）：首屏总传输 530KB → 164KB，`load` 事件 3025ms → 1150ms，背景图 2635ms → 980ms；连续滚动 115 帧中超过 32ms 的掉帧 42 → 5，平均帧间隔 23.6ms → 17.4ms。

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 已配好：推到 `main` 自动构建发布。仓库 Settings → Pages → Source 选 **GitHub Actions**。线上地址：`https://xiaomu-yxjs.github.io/Xiaomu/`。

`astro.config.mjs` 的 `site` / `base` 与 `public/robots.txt` 里的 Sitemap 地址已按项目页路径配置；手写链接统一走 `withBase()`，避免 Pages 子路径 404。

### 域名红线（顺序不能错）

`ICP 备案完成 → DNS 解析生效 → 再挂自定义域名并强制 HTTPS`。
备案/DNS 没就绪就挂域名，等于全站 502 或证书错误。

另外：**GitHub Pages 属于境外托管，本身不需要 ICP 备案**，但国内访问速度不稳定，且自定义域名走国内 CDN/服务器时才需要备案 —— 原提示词库那句「先备案」默认的是国内主机场景，别混用。

## 还没做的（下一步）

- 攻略/测评长文页（`/guides/[slug]`，MDX 或 Markdown 内容集）
- 云端投稿 + 评论（`guides` / `comments` 两张表 + RLS，见提示词库第八节）
- 百度主动推送脚本、图片 CDN 托管

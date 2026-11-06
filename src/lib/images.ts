import type { ImageMetadata } from 'astro';

const covers = import.meta.glob<{ default: ImageMetadata }>('../assets/covers/*.jpg', {
  eager: true,
});

const shots = import.meta.glob<{ default: ImageMetadata }>('../assets/shots/*.jpg', {
  eager: true,
});

const icons = import.meta.glob<{ default: ImageMetadata }>('../assets/icons/*.{jpg,png}', {
  eager: true,
});

function pick(map: Record<string, { default: ImageMetadata }>, name: string): ImageMetadata {
  const mod = map[`../assets/${name}.jpg`];
  if (!mod) {
    throw new Error(
      `找不到图片 ${name}.jpg。请把官方素材放进 src/assets/，或检查 data/games.json 里的文件名。`,
    );
  }
  return mod.default;
}

/** 拿到封面（12:5 扁横幅）的 ImageMetadata，交给 <Image> 做自动压缩/裁剪 */
export function getCover(name: string): ImageMetadata {
  return pick(covers, `covers/${name}`);
}

/** 拿到截图的 ImageMetadata，找不到时返回 undefined（调用方负责隐藏画廊） */
export function getShot(name: string): ImageMetadata | undefined {
  return shots[`../assets/shots/${name}.jpg`]?.default;
}

export function getShots(names: string[]): ImageMetadata[] {
  return names.map(getShot).filter((s): s is ImageMetadata => Boolean(s));
}

/** 拿到游戏图标的 ImageMetadata（App 图标），没有时返回 undefined */
export function getIcon(name?: string): ImageMetadata | undefined {
  if (!name) return undefined;
  return (
    icons[`../assets/icons/${name}.png`]?.default ??
    icons[`../assets/icons/${name}.jpg`]?.default
  );
}

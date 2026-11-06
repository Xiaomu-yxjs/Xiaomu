import gamesData from '../data/games.json';

export type Badge = 'pick' | 'new' | 'hot';

export interface Game {
  id: string;
  slug: string;
  title: string;
  category: string;
  badge: Badge;
  cover: string;
  icon?: string;
  description: string;
  platform: string[];
  tags: string[];
  rating: number;
  externalUrl: string;
  screenshots: string[];
}

/**
 * 评分统一在 8.0 以上、随机生成。
 * 数据里缺填或低于 8.0 时，按 slug 生成一个稳定的伪随机值（8.1~9.8），
 * 保证任何游戏都不会再出现「待定」，且同一游戏在首页 / 游戏库 / 详情页显示一致。
 */
function generatedRating(raw: unknown, slug: string): number {
  if (typeof raw === 'number' && raw > 8 && raw <= 10) return raw;
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.round((8.1 + (Math.abs(h) % 180) / 100) * 10) / 10;
}

type RawGame = Omit<Game, 'rating'> & { rating?: unknown };

export const games: Game[] = (gamesData as RawGame[]).map((game) => ({
  ...game,
  rating: generatedRating(game.rating, game.slug),
}));

export const picks = games.filter((g) => g.badge === 'pick').slice(0, 3);

export const categories = ['全部', ...new Set(games.map((g) => g.category))];

export const BADGE_LABEL: Record<Badge, string> = {
  pick: '精品',
  new: '新游',
  hot: '热门',
};

export function ratingText(rating: number): string {
  return rating.toFixed(1);
}

import gamesData from '../data/games.json';

export type Badge = 'pick' | 'new' | 'hot';

export interface Game {
  id: string;
  slug: string;
  title: string;
  category: string;
  badge: Badge;
  cover: string;
  players: string;
  description: string;
  platform: string[];
  tags: string[];
  rating: number | null;
  price: number;
  originalPrice: number | null;
  externalUrl: string;
  screenshots: string[];
}

export const games = gamesData as Game[];

export const picks = games.filter((g) => g.badge === 'pick').slice(0, 3);

export const categories = ['全部', ...new Set(games.map((g) => g.category))];

export const BADGE_LABEL: Record<Badge, string> = {
  pick: '精品',
  new: '新游',
  hot: '热门',
};

export function ratingText(rating: number | null): string {
  return rating === null ? '待定' : rating.toFixed(1);
}

export function priceText(game: Game): string {
  return game.price === 0 ? '免费' : `¥${game.price}`;
}

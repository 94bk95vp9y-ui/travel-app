import { BedDouble, Landmark, Mountain, Sparkles, Ticket, Utensils, Wine, type LucideIcon } from 'lucide-react';
import type { IdeaCategory } from './types';

export interface CategoryMeta {
  id: IdeaCategory;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food', label: 'Essen & Trinken', icon: Utensils, color: '#ff9f5a' },
  { id: 'sight', label: 'Sehenswert', icon: Landmark, color: '#6cb6ff' },
  { id: 'nature', label: 'Natur', icon: Mountain, color: '#5ed39a' },
  { id: 'activity', label: 'Erlebnis', icon: Ticket, color: '#ff7eb6' },
  { id: 'stay', label: 'Unterkunft', icon: BedDouble, color: '#c4a7ff' },
  { id: 'nightlife', label: 'Nachtleben', icon: Wine, color: '#ff6b8a' },
  { id: 'other', label: 'Sonstiges', icon: Sparkles, color: '#a8b3cf' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<IdeaCategory, CategoryMeta>;

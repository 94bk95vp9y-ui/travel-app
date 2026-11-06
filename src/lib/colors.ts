import type { Status } from './types';

export const STATUS_COLORS: Record<Status, string> = {
  visited: '#ffb547',
  wishlist: '#a78bfa',
};

export const STATUS_LABEL: Record<Status, string> = {
  visited: 'Besucht',
  wishlist: 'Will hin',
};

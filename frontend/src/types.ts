export type ItemType = 'product' | 'fund' | 'giftcard';
export type Theme = 'marigold' | 'rani' | 'peacock' | 'mehendi';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  url: string;
  image: string;
  store: string;
  category: string;
  price: number;
  qty: number;
  target: number;
  mostWanted: boolean;
  order: number;
  createdAt: number;
  // computed by the API
  raised: number;
  claimed: number;
  contributors: number;
}

export interface Gift {
  id: string;
  itemId: string;
  itemTitle: string;
  type: 'purchase' | 'contribution';
  guestName: string;
  phone: string;
  message: string;
  amount: number;
  orderRef?: string;
  upiRef?: string;
  thanked: boolean;
  received: boolean;
  createdAt: number;
}

export interface RegistryDetails {
  partner1: string;
  partner2: string;
  date: string;
  city: string;
  venue: string;
  note: string;
  cover: string;
  theme: Theme;
  upiId: string;
  upiName: string;
  address?: string; // owner only
}

export interface Registry extends RegistryDetails {
  id: string;
  slug: string;
  items: Item[];
  gifts?: Gift[]; // owner only
}

export interface Me {
  user?: { name: string; email: string } | null;
  registry?: Registry | null;
}

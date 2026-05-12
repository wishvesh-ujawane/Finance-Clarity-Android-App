import {
  ShoppingCart, Home, Smile, Car, Heart, Utensils,
  Briefcase, Laptop, TrendingUp, Coffee, Music, Film,
  ShoppingBag, Zap, Globe, Gift, Plane, Book, Star,
  CreditCard, Pizza, Shirt, Dumbbell, Baby, DollarSign,
  Wallet, PiggyBank, Building2, type LucideProps
} from 'lucide-react';
import { ElementType } from 'react';

export const ICON_OPTIONS = [
  'ShoppingCart', 'Home', 'Smile', 'Car', 'Heart', 'Utensils',
  'Briefcase', 'Laptop', 'TrendingUp', 'Coffee', 'Music', 'Film',
  'ShoppingBag', 'Zap', 'Globe', 'Gift', 'Plane', 'Book', 'Star',
  'CreditCard', 'Pizza', 'Shirt', 'Dumbbell', 'Baby', 'DollarSign',
  'Wallet', 'PiggyBank', 'Building2',
];

const ICON_MAP: Record<string, ElementType<LucideProps>> = {
  ShoppingCart, Home, Smile, Car, Heart, Utensils,
  Briefcase, Laptop, TrendingUp, Coffee, Music, Film,
  ShoppingBag, Zap, Globe, Gift, Plane, Book, Star,
  CreditCard, Pizza, Shirt, Dumbbell, Baby, DollarSign,
  Wallet, PiggyBank, Building2,
};

interface CategoryIconProps {
  icon: string;
  color?: string;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, color, size = 18, className }: CategoryIconProps) {
  const Icon = ICON_MAP[icon] || DollarSign;
  return <Icon size={size} color={color} className={className} />;
}

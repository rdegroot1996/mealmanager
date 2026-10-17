export enum SupermarketProvider {
  Picnic = 'picnic',
}
export type SupermarketProviderId = `${SupermarketProvider}`;
export interface ApiSupermarketConnection {
  provider: SupermarketProviderId;
  name: string;
  status: 'Disconnected' | 'Connected' | 'ReconnectRequired';
  accountLabel: string | null;
}
export interface ApiSupermarketProduct {
  id: string;
  name: string;
  pack: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  availability: 'Available' | 'Unavailable' | 'Missing' | 'Unknown';
  maxQuantity: number | null;
}
export interface ApiSupermarketReviewItem {
  shoppingListItemId: string;
  recipeProfileGroceryItemId: string | null;
  name: string;
  quantity: number;
  checked: boolean;
  group: string;
  product: ApiSupermarketProduct | null;
}
export interface ApiSupermarketReview {
  provider: SupermarketProviderId;
  accountId: string;
  connectionGeneration: string;
  revision: string;
  items: ApiSupermarketReviewItem[];
  unreviewedMeals: number;
}
export interface ApiSupermarketSelection {
  shoppingListItemId: string;
  productId: string;
  quantity: number;
  remember: boolean;
}
export interface ApiSupermarketSendLine {
  productId: string;
  productName: string;
  pack: string;
  quantity: number;
  outcome: 'Added' | 'Failed' | 'Unknown' | 'NotAttempted';
  reason: string | null;
  shoppingListItemIds: string[];
  localWarning: string | null;
}
export interface ApiSupermarketSend {
  planningCycleId: string;
  provider: SupermarketProviderId;
  accountId: string;
  accountLabel: string;
  connectionGeneration: string;
  lines: ApiSupermarketSendLine[];
}

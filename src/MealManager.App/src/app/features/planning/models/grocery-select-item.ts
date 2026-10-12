export interface GrocerySelectItem {
  id: string;
  recipeProfileProductId: string | null;
  name: string;
  quantity: number;
  selected: boolean;
  atHome: boolean;
  purchaseOrder: number | null;
}

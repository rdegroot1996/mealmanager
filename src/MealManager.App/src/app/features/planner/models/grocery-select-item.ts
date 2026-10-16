export interface GrocerySelectItem {
  id: string;
  recipeProfileGroceryItemId: string | null;
  name: string;
  quantity: number;
  selected: boolean;
  atHome: boolean;
  purchaseOrder: number | null;
}

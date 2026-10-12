export interface ApiRecipeTag {
  id: string;
  name: string;
}

export interface ApiRecipeSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  tags: ApiRecipeTag[];
  isFavorite: boolean;
}

export interface ApiRecipeProfileSummary {
  id: string;
  name: string;
  servings: number;
}

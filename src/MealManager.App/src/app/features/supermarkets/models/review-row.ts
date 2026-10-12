import { ApiSupermarketReviewItem } from '../../../api/models/api-supermarkets';
export interface ReviewRow extends ApiSupermarketReviewItem {
  selected: boolean;
  remember: boolean;
  buyQuantity: number;
}

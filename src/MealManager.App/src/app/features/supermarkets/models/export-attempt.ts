import { SupermarketProviderId } from '../../../api/models/api-supermarkets';

export interface ExportAttempt {
  provider: SupermarketProviderId;
  accountLabel: string;
}

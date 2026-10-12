import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../shared/services/api-error-message';

export function supermarketError(error: unknown) {
  if (error instanceof HttpErrorResponse && error.error?.code === 'SupermarketConnectionRequired')
    return $localize`:@@supermarkets.connectionUnavailable:The supermarket connection is unavailable. Try again once it is connected.`;
  return apiErrorMessage(error);
}

export function availability(value: string) {
  switch (value) {
    case 'Available':
      return $localize`:@@supermarkets.available:Available`;
    case 'Unavailable':
      return $localize`:@@supermarkets.unavailable:Unavailable`;
    case 'Missing':
      return $localize`:@@supermarkets.missing:Product no longer found`;
    default:
      return $localize`:@@supermarkets.unknown:Availability could not be verified`;
  }
}

export function outcomeLabel(value: string) {
  return value === 'Added'
    ? $localize`:@@supermarkets.added:Added`
    : $localize`:@@supermarkets.failed:Could not add`;
}

export function outcomeReason(value: string | null, outcome?: string) {
  if (outcome === 'NotAttempted' && value === 'LocalPersistence')
    return $localize`:@@supermarkets.reasonExportFailed:The export failed. Try again in a new round.`;
  switch (value) {
    case 'Unavailable':
      return $localize`:@@supermarkets.reasonUnavailable:The product is unavailable. Choose a replacement.`;
    case 'Quantity':
      return $localize`:@@supermarkets.reasonQuantity:The supermarket rejected this quantity. Adjust the number of packs.`;
    case 'SessionExpired':
      return $localize`:@@supermarkets.reasonExpired:The supermarket connection expired. Try again once it is connected.`;
    case 'ConnectionChanged':
      return $localize`:@@supermarkets.connectionChanged:The connection changed. Try again to load its current product choices.`;
    case 'Uncertain':
      return $localize`:@@supermarkets.reasonExportFailed:The export failed. Try again in a new round.`;
    case 'Deadline':
      return $localize`:@@supermarkets.reasonDeadline:Export timed out. Try again in a new round.`;
    case 'LocalPersistence':
      return $localize`:@@supermarkets.localSaveWarning:The cart addition was confirmed, but local updates could not be saved. Check your Shopping list and connection before continuing. Do not resend this product.`;
    case 'MappingChanged':
      return $localize`:@@supermarkets.mappingChanged:The source or connection changed. Its saved product choice was kept.`;
    case 'Rejected':
      return $localize`:@@supermarkets.reasonRejected:The supermarket rejected this product. Choose a replacement or try again later.`;
    default:
      return value
        ? $localize`:@@supermarkets.reasonExportFailed:The export failed. Try again in a new round.`
        : '';
  }
}

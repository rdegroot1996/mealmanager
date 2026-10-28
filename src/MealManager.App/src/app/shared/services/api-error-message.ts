import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_LOCALE } from '../../core/i18n/locale';

/** Converts API ProblemDetails into safe, actionable UI text. */
export function apiErrorMessage(
  error: unknown,
  fallback = $localize`:@@shared.apiErrorMessage.somethingWentWrongPleaseTryAgain:Something went wrong. Please try again.`,
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const body = error.error;
  if ((document.documentElement.lang || DEFAULT_LOCALE) === DEFAULT_LOCALE) {
    if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail;
    if (typeof body?.title === 'string' && body.title.trim()) return body.title;
  }
  if (typeof body?.code === 'string') return localizedProblemCode(body.code) ?? fallback;
  return fallback;
}

function localizedProblemCode(code: string): string | null {
  switch (code) {
    case 'SupermarketConnectionRequired':
      return $localize`:@@apiError.supermarketConnection:Connect or reconnect the same supermarket account in Settings.`;
    case 'SupermarketAuthentication':
      return $localize`:@@apiError.supermarketAuthentication:Check your supermarket credentials or verification code. Reconnect if your session expired.`;
    case 'SupermarketReviewChanged':
      return $localize`:@@apiError.supermarketReviewChanged:The groceries changed. Reopen the supermarket review.`;
    case 'SupermarketSelectionInvalid':
      return $localize`:@@apiError.supermarketSelection:Resolve product choices and whole pack quantities before sending.`;
    case 'SupermarketRequestFailed':
      return $localize`:@@apiError.supermarketRequest:The supermarket request could not be completed. Try again later.`;
    case 'NotFound':
      return $localize`:@@apiError.notFound:This item no longer exists. Refresh and try again.`;
    case 'Unauthorized':
      return $localize`:@@apiError.unauthorized:You are not allowed to perform this action.`;
    case 'ValidationError':
      return $localize`:@@apiError.validation:Check the entered values and try again.`;
    case 'CannotRemoveOwnAdminRole':
      return $localize`:@@apiError.cannotRemoveOwnAdminRole:You cannot remove your own administrator role.`;
    case 'CannotDeleteSelf':
      return $localize`:@@apiError.cannotDeleteSelf:You cannot delete your own account.`;
    case 'CannotResetOwnPassword':
      return $localize`:@@apiError.cannotResetOwnPassword:Use Change password to change your own password.`;
    case 'PasswordChangeRequired':
      return $localize`:@@apiError.passwordChangeRequired:Replace your temporary password before continuing.`;
    case 'RecipeInUse':
      return $localize`:@@apiError.recipeInUse:This recipe is used in a meal plan and cannot be deleted.`;
    case 'LeftoverAlreadyPlanned':
      return $localize`:@@apiError.leftoverAlreadyPlanned:Leftovers are already planned for that date.`;
    case 'MealMustPrecedeLeftovers':
      return $localize`:@@apiError.mealMustPrecedeLeftovers:The meal must remain before all of its leftovers.`;
    case 'InvalidProfileGroceries':
      return $localize`:@@apiError.invalidProfileGroceries:Some groceries no longer belong to the selected profile. Reopen the form and try again.`;
    case 'GroceriesNotReviewed':
      return $localize`:@@apiError.groceriesNotReviewed:Review this meal's groceries before adding another item.`;
    case 'InvalidShoppingListOrder':
      return $localize`:@@apiError.invalidShoppingListOrder:The shopping list changed. Refresh it before reordering.`;
    case 'CycleMustStartAfterExisting':
      return $localize`:@@apiError.cycleMustStartAfterExisting:The new cycle must start after all existing cycle start dates.`;
    case 'CycleStartDateExists':
      return $localize`:@@apiError.cycleStartDateExists:A planning cycle already starts on this date.`;
    case 'PlanningDayNoteExists':
      return $localize`:@@apiError.planningDayNoteExists:This date already has a day note.`;
    case 'DateOutsideCycle':
      return $localize`:@@apiError.dateOutsideCycle:Choose a date inside the planning cycle.`;
    case 'LeftoverMustFollowOriginal':
      return $localize`:@@apiError.leftoverMustFollowOriginal:Plan leftovers after their original meal.`;
    case 'CycleCannotExcludeEntries':
      return $localize`:@@apiError.cycleCannotExcludeEntries:The cycle cannot exclude existing meals, leftovers, or notes.`;
    case 'ActiveCycleRequired':
      return $localize`:@@apiError.activeCycleRequired:This operation requires the active planning cycle.`;
    case 'ApplicationAlreadyInitialized':
      return $localize`:@@apiError.applicationAlreadyInitialized:Setup has already been completed.`;
    case 'InvalidRecipeImageOrder':
      return $localize`:@@apiError.invalidRecipeImageOrder:The recipe photos changed. Reload before reordering them.`;
    case 'RecipeProfileInUse':
      return $localize`:@@apiError.recipeProfileInUse:This profile is used in a meal plan and cannot be deleted.`;
    case 'RecipeMustKeepProfile':
      return $localize`:@@apiError.recipeMustKeepProfile:A recipe must keep at least one profile.`;
    default:
      return null;
  }
}

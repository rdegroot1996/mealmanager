namespace MealManager.Common.Errors;

public static class ErrorCodes
{
    public const string NotFound = nameof(NotFound);
    public const string InvalidOperation = nameof(InvalidOperation);
    public const string Unauthorized = nameof(Unauthorized);
    public const string ValidationError = nameof(ValidationError);
    public const string CannotRemoveOwnAdminRole = nameof(CannotRemoveOwnAdminRole);
    public const string CannotDeleteSelf = nameof(CannotDeleteSelf);
    public const string RecipeInUse = nameof(RecipeInUse);
    public const string LeftoverAlreadyPlanned = nameof(LeftoverAlreadyPlanned);
    public const string MealMustPrecedeLeftovers = nameof(MealMustPrecedeLeftovers);
    public const string InvalidProfileGroceries = nameof(InvalidProfileGroceries);
    public const string GroceriesNotReviewed = nameof(GroceriesNotReviewed);
    public const string InvalidShoppingListOrder = nameof(InvalidShoppingListOrder);
    public const string CycleMustStartAfterExisting = nameof(CycleMustStartAfterExisting);
    public const string CycleStartDateExists = nameof(CycleStartDateExists);
    public const string PlanningDayNoteExists = nameof(PlanningDayNoteExists);
    public const string DateOutsideCycle = nameof(DateOutsideCycle);
    public const string LeftoverMustFollowOriginal = nameof(LeftoverMustFollowOriginal);
    public const string CycleCannotExcludeEntries = nameof(CycleCannotExcludeEntries);
    public const string HistoricalCycleReadOnly = nameof(HistoricalCycleReadOnly);
    public const string ApplicationAlreadyInitialized = nameof(ApplicationAlreadyInitialized);
    public const string InvalidRecipeImageOrder = nameof(InvalidRecipeImageOrder);
    public const string RecipeProfileInUse = nameof(RecipeProfileInUse);
    public const string RecipeMustKeepProfile = nameof(RecipeMustKeepProfile);
    public const string MealPlanChanged = nameof(MealPlanChanged);
    public const string RecipeChanged = nameof(RecipeChanged);
    public const string InvalidMealPlan = nameof(InvalidMealPlan);
    public const string SupermarketConnectionRequired = nameof(SupermarketConnectionRequired);
    public const string SupermarketAuthentication = nameof(SupermarketAuthentication);
    public const string SupermarketReviewChanged = nameof(SupermarketReviewChanged);
    public const string SupermarketSelectionInvalid = nameof(SupermarketSelectionInvalid);
    public const string SupermarketRequestFailed = nameof(SupermarketRequestFailed);
}

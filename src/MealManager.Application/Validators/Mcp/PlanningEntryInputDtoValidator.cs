using MealManager.Common.Enums;

namespace MealManager.Application.Validators.Mcp;

public sealed class PlanningEntryInputDtoValidator : AbstractValidator<PlanningEntryInputDto>
{
    public PlanningEntryInputDtoValidator()
    {
        RuleFor(entry => entry.Kind).IsInEnum();
        RuleFor(entry => entry.Id).NotEmpty().When(entry => entry.Id.HasValue);
        RuleFor(entry => entry.ClientKey).NotEmpty().MaximumLength(100).When(entry => !entry.Id.HasValue);
        RuleFor(entry => entry.ClientKey).Null().When(entry => entry.Id.HasValue);
        When(entry => entry.Kind == PlanningEntryKind.Meal, () =>
        {
            RuleFor(entry => entry.RecipeId).NotEmpty();
            RuleFor(entry => entry.ProfileId).NotEmpty();
            RuleFor(entry => entry.OriginalMealId).Null();
            RuleFor(entry => entry.OriginalMealKey).Null();
        });
        When(entry => entry.Kind == PlanningEntryKind.Leftover, () =>
        {
            RuleFor(entry => entry.RecipeId).Null();
            RuleFor(entry => entry.ProfileId).Null();
            RuleFor(entry => entry).Must(entry =>
                (entry.OriginalMealId.HasValue && entry.OriginalMealId != Guid.Empty && entry.OriginalMealKey is null) ||
                (!entry.OriginalMealId.HasValue && !string.IsNullOrWhiteSpace(entry.OriginalMealKey)))
                .WithMessage("A leftover must specify either originalMealId or originalMealKey.");
        });
    }
}

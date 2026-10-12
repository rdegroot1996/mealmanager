using MealManager.Infrastructure.Supermarkets;
namespace MealManager.Application.Validators;

public sealed class SendSupermarketDtoValidator : AbstractValidator<SendSupermarketDto>
{
    public SendSupermarketDtoValidator()
    {
        RuleFor(x => x.Provider).IsInEnum();
        RuleFor(x => x.AccountId).NotEmpty().MaximumLength(254);
        RuleFor(x => x.ConnectionGeneration).NotEmpty();
        RuleFor(x => x.Revision).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Items).NotNull().Must(x => x is not null && x.Count is > 0 and <= SupermarketLimits.MaxSelections);
        RuleFor(x => x.Totals).NotNull();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty().MaximumLength(200);
            item.RuleFor(x => x.Quantity).InclusiveBetween(1, SupermarketLimits.MaxQuantity);
        });
        RuleForEach(x => x.Totals).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty().MaximumLength(200);
            item.RuleFor(x => x.Quantity).InclusiveBetween(1, SupermarketLimits.MaxQuantity);
        });
    }
}

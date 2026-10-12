namespace MealManager.Domain.Contracts;

public sealed class SupermarketException(SupermarketFailure failure) : Exception(failure.ToString())
{
    public SupermarketFailure Failure { get; } = failure;
}

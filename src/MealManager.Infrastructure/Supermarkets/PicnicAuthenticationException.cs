namespace MealManager.Infrastructure.Supermarkets;

public sealed class PicnicAuthenticationException(PicnicAuthenticationFailure failure) : Exception(failure.ToString())
{
    public PicnicAuthenticationFailure Failure { get; } = failure;
}

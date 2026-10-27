using FluentValidation.Results;
using Microsoft.AspNetCore.Identity;

namespace MealManager.Application;

public static class IdentityResultExtensions
{
    public static void EnsureSucceeded(this IdentityResult result)
    {
        if (result.Succeeded)
        {
            return;
        }

        throw new ValidationException(
            result.Errors.Select(error => new ValidationFailure(error.Code, error.Description)));
    }
}

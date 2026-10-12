using Microsoft.AspNetCore.Identity;

namespace MealManager.Domain.Entities;

public class User : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = null!;
}

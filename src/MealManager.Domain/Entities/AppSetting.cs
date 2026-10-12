using System.ComponentModel.DataAnnotations;

namespace MealManager.Domain.Entities;

public class AppSetting
{
    [Key]
    public string Key { get; set; } = null!;

    public string Value { get; set; } = null!;
}

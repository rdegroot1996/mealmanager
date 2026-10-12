using System.ComponentModel.DataAnnotations;

namespace MealManager.Domain.Entities;

public abstract class BaseEntity
{
    [Key]
    public required Guid Id { get; set; }
}

using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class ShoppingListEntityConfiguration : IEntityTypeConfiguration<ShoppingList>
{
    public void Configure(EntityTypeBuilder<ShoppingList> builder)
    {

        builder.HasIndex(list => list.PlanningCycleId).IsUnique();
    }
}

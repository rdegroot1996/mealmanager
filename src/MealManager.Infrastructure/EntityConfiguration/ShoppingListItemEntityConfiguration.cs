using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class ShoppingListItemEntityConfiguration : IEntityTypeConfiguration<ShoppingListItem>
{
    public void Configure(EntityTypeBuilder<ShoppingListItem> builder)
    {

        builder.HasOne(item => item.RecipeProfileGroceryItem)
            .WithMany()
            .HasForeignKey(item => item.RecipeProfileGroceryItemId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class GroceryItemEntityConfiguration : IEntityTypeConfiguration<GroceryItem>
{
    public void Configure(EntityTypeBuilder<GroceryItem> builder)
    {
        builder.HasOne(item => item.RecipeProfileProduct)
            .WithMany()
            .HasForeignKey(item => item.RecipeProfileProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

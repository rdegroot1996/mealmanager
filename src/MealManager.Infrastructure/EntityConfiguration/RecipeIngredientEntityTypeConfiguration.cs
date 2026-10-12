using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class RecipeIngredientEntityTypeConfiguration : IEntityTypeConfiguration<RecipeIngredient>
{
    public void Configure(EntityTypeBuilder<RecipeIngredient> builder)
    {
        builder.Property(i => i.Quantity).HasPrecision(10, 3);
    }
}

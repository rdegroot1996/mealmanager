using MealManager.Common.Enums;
using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace MealManager.Infrastructure.EntityConfiguration;

public class SupermarketProductMappingConfiguration : IEntityTypeConfiguration<SupermarketProductMapping>
{
    public void Configure(EntityTypeBuilder<SupermarketProductMapping> builder)
    {
        builder.Property(x => x.Provider).HasConversion(value => value.ToString().ToLowerInvariant(), value => Enum.Parse<SupermarketProvider>(value, true));
        builder.HasIndex(x => new { x.RecipeProfileProductId, x.Provider }).IsUnique();
        builder.HasOne(x => x.RecipeProfileProduct).WithMany().HasForeignKey(x => x.RecipeProfileProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

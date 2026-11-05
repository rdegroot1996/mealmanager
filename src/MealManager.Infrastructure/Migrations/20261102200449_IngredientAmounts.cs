using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealManager.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class IngredientAmounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "RecipeIngredient",
                type: "TEXT",
                precision: 10,
                scale: 3,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 10,
                oldScale: 3);

            migrationBuilder.AddColumn<string>(
                name: "QuantityText",
                table: "RecipeIngredient",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuantityText",
                table: "RecipeIngredient");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "RecipeIngredient",
                type: "TEXT",
                precision: 10,
                scale: 3,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "TEXT",
                oldPrecision: 10,
                oldScale: 3,
                oldNullable: true);
        }
    }
}

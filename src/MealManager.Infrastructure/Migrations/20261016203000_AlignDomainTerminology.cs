using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealManager.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignDomainTerminology : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GroceryItem_GroceryLists_GroceryListId",
                table: "GroceryItem");

            migrationBuilder.DropForeignKey(
                name: "FK_GroceryItem_PlanningEntry_PlanningMealId",
                table: "GroceryItem");

            migrationBuilder.DropForeignKey(
                name: "FK_GroceryItem_RecipeProfileProduct_RecipeProfileProductId",
                table: "GroceryItem");

            migrationBuilder.DropForeignKey(
                name: "FK_GroceryLists_PlanningCycles_PlanningCycleId",
                table: "GroceryLists");

            migrationBuilder.DropForeignKey(
                name: "FK_MealGroceries_PlanningEntry_PlanningMealId",
                table: "MealGroceries");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningEntry_PlanningEntry_OriginalMealId",
                table: "PlanningEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningEntry_Plannings_PlanningId",
                table: "PlanningEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningEntry_RecipeProfile_RecipeProfileId",
                table: "PlanningEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningEntry_Recipes_RecipeId",
                table: "PlanningEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningNote_Plannings_PlanningId",
                table: "PlanningNote");

            migrationBuilder.DropForeignKey(
                name: "FK_Plannings_PlanningCycles_PlanningCycleId",
                table: "Plannings");

            migrationBuilder.DropForeignKey(
                name: "FK_RecipeProfileProduct_RecipeProfile_RecipeProfileId",
                table: "RecipeProfileProduct");

            migrationBuilder.DropForeignKey(
                name: "FK_SupermarketProductMappings_RecipeProfileProduct_RecipeProfileProductId",
                table: "SupermarketProductMappings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RecipeProfileProduct",
                table: "RecipeProfileProduct");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Plannings",
                table: "Plannings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PlanningNote",
                table: "PlanningNote");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PlanningEntry",
                table: "PlanningEntry");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PlanningEntry_ValidKind",
                table: "PlanningEntry");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MealGroceries",
                table: "MealGroceries");

            migrationBuilder.DropPrimaryKey(
                name: "PK_GroceryLists",
                table: "GroceryLists");

            migrationBuilder.DropPrimaryKey(
                name: "PK_GroceryItem",
                table: "GroceryItem");

            migrationBuilder.RenameTable(
                name: "RecipeProfileProduct",
                newName: "RecipeProfileGroceryItem");

            migrationBuilder.RenameTable(
                name: "Plannings",
                newName: "MealPlans");

            migrationBuilder.RenameTable(
                name: "PlanningNote",
                newName: "PlanningDayNote");

            migrationBuilder.RenameTable(
                name: "PlanningEntry",
                newName: "PlannedEntry");

            migrationBuilder.RenameTable(
                name: "MealGroceries",
                newName: "MealGroceryReview");

            migrationBuilder.RenameTable(
                name: "GroceryLists",
                newName: "ShoppingLists");

            migrationBuilder.RenameTable(
                name: "GroceryItem",
                newName: "ShoppingListItem");

            migrationBuilder.RenameColumn(
                name: "RecipeProfileProductId",
                table: "SupermarketProductMappings",
                newName: "RecipeProfileGroceryItemId");

            migrationBuilder.RenameIndex(
                name: "IX_SupermarketProductMappings_RecipeProfileProductId_Provider",
                table: "SupermarketProductMappings",
                newName: "IX_SupermarketProductMappings_RecipeProfileGroceryItemId_Provider");

            migrationBuilder.RenameIndex(
                name: "IX_RecipeProfileProduct_RecipeProfileId",
                table: "RecipeProfileGroceryItem",
                newName: "IX_RecipeProfileGroceryItem_RecipeProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_Plannings_PlanningCycleId",
                table: "MealPlans",
                newName: "IX_MealPlans_PlanningCycleId");

            migrationBuilder.RenameColumn(
                name: "PlanningId",
                table: "PlanningDayNote",
                newName: "MealPlanId");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningNote_PlanningId_Date",
                table: "PlanningDayNote",
                newName: "IX_PlanningDayNote_MealPlanId_Date");

            migrationBuilder.RenameColumn(
                name: "PlanningId",
                table: "PlannedEntry",
                newName: "MealPlanId");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningEntry_RecipeProfileId",
                table: "PlannedEntry",
                newName: "IX_PlannedEntry_RecipeProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningEntry_RecipeId",
                table: "PlannedEntry",
                newName: "IX_PlannedEntry_RecipeId");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningEntry_PlanningId_Date_SortOrder",
                table: "PlannedEntry",
                newName: "IX_PlannedEntry_MealPlanId_Date_SortOrder");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningEntry_OriginalMealId_Date",
                table: "PlannedEntry",
                newName: "IX_PlannedEntry_OriginalMealId_Date");

            migrationBuilder.RenameColumn(
                name: "PlanningMealId",
                table: "MealGroceryReview",
                newName: "PlannedMealId");

            migrationBuilder.RenameIndex(
                name: "IX_MealGroceries_PlanningMealId",
                table: "MealGroceryReview",
                newName: "IX_MealGroceryReview_PlannedMealId");

            migrationBuilder.RenameIndex(
                name: "IX_GroceryLists_PlanningCycleId",
                table: "ShoppingLists",
                newName: "IX_ShoppingLists_PlanningCycleId");

            migrationBuilder.RenameColumn(
                name: "RecipeProfileProductId",
                table: "ShoppingListItem",
                newName: "RecipeProfileGroceryItemId");

            migrationBuilder.RenameColumn(
                name: "PlanningMealId",
                table: "ShoppingListItem",
                newName: "PlannedMealId");

            migrationBuilder.RenameColumn(
                name: "GroceryListId",
                table: "ShoppingListItem",
                newName: "ShoppingListId");

            migrationBuilder.RenameIndex(
                name: "IX_GroceryItem_RecipeProfileProductId",
                table: "ShoppingListItem",
                newName: "IX_ShoppingListItem_RecipeProfileGroceryItemId");

            migrationBuilder.RenameIndex(
                name: "IX_GroceryItem_PlanningMealId",
                table: "ShoppingListItem",
                newName: "IX_ShoppingListItem_PlannedMealId");

            migrationBuilder.RenameIndex(
                name: "IX_GroceryItem_GroceryListId",
                table: "ShoppingListItem",
                newName: "IX_ShoppingListItem_ShoppingListId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_RecipeProfileGroceryItem",
                table: "RecipeProfileGroceryItem",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MealPlans",
                table: "MealPlans",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PlanningDayNote",
                table: "PlanningDayNote",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PlannedEntry",
                table: "PlannedEntry",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MealGroceryReview",
                table: "MealGroceryReview",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ShoppingLists",
                table: "ShoppingLists",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ShoppingListItem",
                table: "ShoppingListItem",
                column: "Id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PlannedEntry_ValidKind",
                table: "PlannedEntry",
                sql: "(EntryType = 'meal' AND OriginalMealId IS NULL AND RecipeId IS NOT NULL AND RecipeProfileId IS NOT NULL) OR (EntryType = 'leftover' AND OriginalMealId IS NOT NULL AND RecipeId IS NULL AND RecipeProfileId IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_MealGroceryReview_PlannedEntry_PlannedMealId",
                table: "MealGroceryReview",
                column: "PlannedMealId",
                principalTable: "PlannedEntry",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MealPlans_PlanningCycles_PlanningCycleId",
                table: "MealPlans",
                column: "PlanningCycleId",
                principalTable: "PlanningCycles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlannedEntry_MealPlans_MealPlanId",
                table: "PlannedEntry",
                column: "MealPlanId",
                principalTable: "MealPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlannedEntry_PlannedEntry_OriginalMealId",
                table: "PlannedEntry",
                column: "OriginalMealId",
                principalTable: "PlannedEntry",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlannedEntry_RecipeProfile_RecipeProfileId",
                table: "PlannedEntry",
                column: "RecipeProfileId",
                principalTable: "RecipeProfile",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlannedEntry_Recipes_RecipeId",
                table: "PlannedEntry",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningDayNote_MealPlans_MealPlanId",
                table: "PlanningDayNote",
                column: "MealPlanId",
                principalTable: "MealPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RecipeProfileGroceryItem_RecipeProfile_RecipeProfileId",
                table: "RecipeProfileGroceryItem",
                column: "RecipeProfileId",
                principalTable: "RecipeProfile",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ShoppingListItem_PlannedEntry_PlannedMealId",
                table: "ShoppingListItem",
                column: "PlannedMealId",
                principalTable: "PlannedEntry",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ShoppingListItem_RecipeProfileGroceryItem_RecipeProfileGroceryItemId",
                table: "ShoppingListItem",
                column: "RecipeProfileGroceryItemId",
                principalTable: "RecipeProfileGroceryItem",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ShoppingListItem_ShoppingLists_ShoppingListId",
                table: "ShoppingListItem",
                column: "ShoppingListId",
                principalTable: "ShoppingLists",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ShoppingLists_PlanningCycles_PlanningCycleId",
                table: "ShoppingLists",
                column: "PlanningCycleId",
                principalTable: "PlanningCycles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SupermarketProductMappings_RecipeProfileGroceryItem_RecipeProfileGroceryItemId",
                table: "SupermarketProductMappings",
                column: "RecipeProfileGroceryItemId",
                principalTable: "RecipeProfileGroceryItem",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MealGroceryReview_PlannedEntry_PlannedMealId",
                table: "MealGroceryReview");

            migrationBuilder.DropForeignKey(
                name: "FK_MealPlans_PlanningCycles_PlanningCycleId",
                table: "MealPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_PlannedEntry_MealPlans_MealPlanId",
                table: "PlannedEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlannedEntry_PlannedEntry_OriginalMealId",
                table: "PlannedEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlannedEntry_RecipeProfile_RecipeProfileId",
                table: "PlannedEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlannedEntry_Recipes_RecipeId",
                table: "PlannedEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanningDayNote_MealPlans_MealPlanId",
                table: "PlanningDayNote");

            migrationBuilder.DropForeignKey(
                name: "FK_RecipeProfileGroceryItem_RecipeProfile_RecipeProfileId",
                table: "RecipeProfileGroceryItem");

            migrationBuilder.DropForeignKey(
                name: "FK_ShoppingListItem_PlannedEntry_PlannedMealId",
                table: "ShoppingListItem");

            migrationBuilder.DropForeignKey(
                name: "FK_ShoppingListItem_RecipeProfileGroceryItem_RecipeProfileGroceryItemId",
                table: "ShoppingListItem");

            migrationBuilder.DropForeignKey(
                name: "FK_ShoppingListItem_ShoppingLists_ShoppingListId",
                table: "ShoppingListItem");

            migrationBuilder.DropForeignKey(
                name: "FK_ShoppingLists_PlanningCycles_PlanningCycleId",
                table: "ShoppingLists");

            migrationBuilder.DropForeignKey(
                name: "FK_SupermarketProductMappings_RecipeProfileGroceryItem_RecipeProfileGroceryItemId",
                table: "SupermarketProductMappings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ShoppingLists",
                table: "ShoppingLists");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ShoppingListItem",
                table: "ShoppingListItem");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RecipeProfileGroceryItem",
                table: "RecipeProfileGroceryItem");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PlanningDayNote",
                table: "PlanningDayNote");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PlannedEntry",
                table: "PlannedEntry");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PlannedEntry_ValidKind",
                table: "PlannedEntry");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MealPlans",
                table: "MealPlans");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MealGroceryReview",
                table: "MealGroceryReview");

            migrationBuilder.RenameTable(
                name: "ShoppingLists",
                newName: "GroceryLists");

            migrationBuilder.RenameTable(
                name: "ShoppingListItem",
                newName: "GroceryItem");

            migrationBuilder.RenameTable(
                name: "RecipeProfileGroceryItem",
                newName: "RecipeProfileProduct");

            migrationBuilder.RenameTable(
                name: "PlanningDayNote",
                newName: "PlanningNote");

            migrationBuilder.RenameTable(
                name: "PlannedEntry",
                newName: "PlanningEntry");

            migrationBuilder.RenameTable(
                name: "MealPlans",
                newName: "Plannings");

            migrationBuilder.RenameTable(
                name: "MealGroceryReview",
                newName: "MealGroceries");

            migrationBuilder.RenameColumn(
                name: "RecipeProfileGroceryItemId",
                table: "SupermarketProductMappings",
                newName: "RecipeProfileProductId");

            migrationBuilder.RenameIndex(
                name: "IX_SupermarketProductMappings_RecipeProfileGroceryItemId_Provider",
                table: "SupermarketProductMappings",
                newName: "IX_SupermarketProductMappings_RecipeProfileProductId_Provider");

            migrationBuilder.RenameIndex(
                name: "IX_ShoppingLists_PlanningCycleId",
                table: "GroceryLists",
                newName: "IX_GroceryLists_PlanningCycleId");

            migrationBuilder.RenameColumn(
                name: "ShoppingListId",
                table: "GroceryItem",
                newName: "GroceryListId");

            migrationBuilder.RenameColumn(
                name: "RecipeProfileGroceryItemId",
                table: "GroceryItem",
                newName: "RecipeProfileProductId");

            migrationBuilder.RenameColumn(
                name: "PlannedMealId",
                table: "GroceryItem",
                newName: "PlanningMealId");

            migrationBuilder.RenameIndex(
                name: "IX_ShoppingListItem_ShoppingListId",
                table: "GroceryItem",
                newName: "IX_GroceryItem_GroceryListId");

            migrationBuilder.RenameIndex(
                name: "IX_ShoppingListItem_RecipeProfileGroceryItemId",
                table: "GroceryItem",
                newName: "IX_GroceryItem_RecipeProfileProductId");

            migrationBuilder.RenameIndex(
                name: "IX_ShoppingListItem_PlannedMealId",
                table: "GroceryItem",
                newName: "IX_GroceryItem_PlanningMealId");

            migrationBuilder.RenameIndex(
                name: "IX_RecipeProfileGroceryItem_RecipeProfileId",
                table: "RecipeProfileProduct",
                newName: "IX_RecipeProfileProduct_RecipeProfileId");

            migrationBuilder.RenameColumn(
                name: "MealPlanId",
                table: "PlanningNote",
                newName: "PlanningId");

            migrationBuilder.RenameIndex(
                name: "IX_PlanningDayNote_MealPlanId_Date",
                table: "PlanningNote",
                newName: "IX_PlanningNote_PlanningId_Date");

            migrationBuilder.RenameColumn(
                name: "MealPlanId",
                table: "PlanningEntry",
                newName: "PlanningId");

            migrationBuilder.RenameIndex(
                name: "IX_PlannedEntry_RecipeProfileId",
                table: "PlanningEntry",
                newName: "IX_PlanningEntry_RecipeProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_PlannedEntry_RecipeId",
                table: "PlanningEntry",
                newName: "IX_PlanningEntry_RecipeId");

            migrationBuilder.RenameIndex(
                name: "IX_PlannedEntry_OriginalMealId_Date",
                table: "PlanningEntry",
                newName: "IX_PlanningEntry_OriginalMealId_Date");

            migrationBuilder.RenameIndex(
                name: "IX_PlannedEntry_MealPlanId_Date_SortOrder",
                table: "PlanningEntry",
                newName: "IX_PlanningEntry_PlanningId_Date_SortOrder");

            migrationBuilder.RenameIndex(
                name: "IX_MealPlans_PlanningCycleId",
                table: "Plannings",
                newName: "IX_Plannings_PlanningCycleId");

            migrationBuilder.RenameColumn(
                name: "PlannedMealId",
                table: "MealGroceries",
                newName: "PlanningMealId");

            migrationBuilder.RenameIndex(
                name: "IX_MealGroceryReview_PlannedMealId",
                table: "MealGroceries",
                newName: "IX_MealGroceries_PlanningMealId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_GroceryLists",
                table: "GroceryLists",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_GroceryItem",
                table: "GroceryItem",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_RecipeProfileProduct",
                table: "RecipeProfileProduct",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PlanningNote",
                table: "PlanningNote",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PlanningEntry",
                table: "PlanningEntry",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Plannings",
                table: "Plannings",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MealGroceries",
                table: "MealGroceries",
                column: "Id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PlanningEntry_ValidKind",
                table: "PlanningEntry",
                sql: "(EntryType = 'meal' AND OriginalMealId IS NULL AND RecipeId IS NOT NULL AND RecipeProfileId IS NOT NULL) OR (EntryType = 'leftover' AND OriginalMealId IS NOT NULL AND RecipeId IS NULL AND RecipeProfileId IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_GroceryItem_GroceryLists_GroceryListId",
                table: "GroceryItem",
                column: "GroceryListId",
                principalTable: "GroceryLists",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GroceryItem_PlanningEntry_PlanningMealId",
                table: "GroceryItem",
                column: "PlanningMealId",
                principalTable: "PlanningEntry",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_GroceryItem_RecipeProfileProduct_RecipeProfileProductId",
                table: "GroceryItem",
                column: "RecipeProfileProductId",
                principalTable: "RecipeProfileProduct",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GroceryLists_PlanningCycles_PlanningCycleId",
                table: "GroceryLists",
                column: "PlanningCycleId",
                principalTable: "PlanningCycles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MealGroceries_PlanningEntry_PlanningMealId",
                table: "MealGroceries",
                column: "PlanningMealId",
                principalTable: "PlanningEntry",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningEntry_PlanningEntry_OriginalMealId",
                table: "PlanningEntry",
                column: "OriginalMealId",
                principalTable: "PlanningEntry",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningEntry_Plannings_PlanningId",
                table: "PlanningEntry",
                column: "PlanningId",
                principalTable: "Plannings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningEntry_RecipeProfile_RecipeProfileId",
                table: "PlanningEntry",
                column: "RecipeProfileId",
                principalTable: "RecipeProfile",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningEntry_Recipes_RecipeId",
                table: "PlanningEntry",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningNote_Plannings_PlanningId",
                table: "PlanningNote",
                column: "PlanningId",
                principalTable: "Plannings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Plannings_PlanningCycles_PlanningCycleId",
                table: "Plannings",
                column: "PlanningCycleId",
                principalTable: "PlanningCycles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RecipeProfileProduct_RecipeProfile_RecipeProfileId",
                table: "RecipeProfileProduct",
                column: "RecipeProfileId",
                principalTable: "RecipeProfile",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SupermarketProductMappings_RecipeProfileProduct_RecipeProfileProductId",
                table: "SupermarketProductMappings",
                column: "RecipeProfileProductId",
                principalTable: "RecipeProfileProduct",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

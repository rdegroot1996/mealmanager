namespace MealManager.Common.Errors;

public class NotFoundError(string name) : BaseError(ErrorCodes.NotFound, $"Object '{name}' not found.")
{
    protected override IDictionary<string, object> GetDetailsInner() =>
        new Dictionary<string, object>
        {
            { "name", name },
        };
}

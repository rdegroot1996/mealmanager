namespace MealManager.Common.Errors;

public abstract class BaseError(string errorCode, string message) : Exception(message)
{
    public string ErrorCode { get; } = errorCode;

    public IDictionary<string, object> GetDetails()
    {
        var details = GetDetailsInner();
        details.Add("message", Message);
        details.Add("errorCode", ErrorCode);
        return details;
    }

    protected virtual IDictionary<string, object> GetDetailsInner() => new Dictionary<string, object>();
}

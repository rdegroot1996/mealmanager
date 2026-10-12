namespace MealManager.Common.Errors;

public class InvalidOperationError(string errorCode = ErrorCodes.InvalidOperation, string message = "Invalid operation.")
    : BaseError(errorCode, message);

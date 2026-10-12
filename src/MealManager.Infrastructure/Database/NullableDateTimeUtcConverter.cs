using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Linq.Expressions;

namespace MealManager.Infrastructure.Database;

public class NullableDateTimeUtcConverter() : ValueConverter<DateTime?, DateTime?>(Convert, Convert)
{
    private static readonly Expression<Func<DateTime?, DateTime?>> Convert = dateTime =>
        dateTime.HasValue
            ? dateTime.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dateTime.Value, DateTimeKind.Utc)
                : dateTime.Value.ToUniversalTime()
            : null;
}

using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Linq.Expressions;

namespace MealManager.Infrastructure.Database;

public class DateTimeUtcConverter() : ValueConverter<DateTime, DateTime>(Convert, Convert)
{
    private static readonly Expression<Func<DateTime, DateTime>> Convert = dateTime =>
        dateTime.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)
            : dateTime.ToUniversalTime();
}

namespace MealManager.Infrastructure.Configuration;

public record AppConfigSetting<T>(string Key, T DefaultValue);

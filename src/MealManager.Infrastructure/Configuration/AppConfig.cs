namespace MealManager.Infrastructure.Configuration;

public class AppConfig
{
    public static AppConfigSetting<bool> AppInitialized { get; set; } = new(nameof(AppInitialized), false);
}

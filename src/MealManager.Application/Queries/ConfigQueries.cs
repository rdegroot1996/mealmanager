using MealManager.Infrastructure.Configuration;
using AppConfig = MealManager.Infrastructure.Configuration.AppConfig;

namespace MealManager.Application.Queries;

public class ConfigQueries(ConfigurationService configurationService)
{
    public async Task<AppConfigDto> GetConfig() =>
        new()
        {
            AppInitialized = await configurationService.GetSetting(AppConfig.AppInitialized),
        };
}

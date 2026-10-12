using MealManager.Common;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Infrastructure.Configuration;

public class ConfigurationService(ApplicationDbContext dbContext)
{
    public async Task<T> GetSetting<T>(AppConfigSetting<T> setting)
    {
        var appSetting = await dbContext.AppSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == setting.Key);
        return appSetting is not null ? JsonSerializer.Deserialize<T>(appSetting.Value)! : setting.DefaultValue;
    }

    public async Task SetSetting<T>(AppConfigSetting<T> setting, T value)
    {
        // Update database
        var appSetting = await dbContext.AppSettings.FirstOrDefaultAsync(x => x.Key == setting.Key);
        if (appSetting is null)
        {
            appSetting = new()
            {
                Key = setting.Key,
                Value = JsonSerializer.Serialize(value),
            };
            dbContext.AppSettings.Add(appSetting);
        }
        else
        {
            appSetting.Value = JsonSerializer.Serialize(value);
        }

        await dbContext.SaveChangesAsync();
    }
}

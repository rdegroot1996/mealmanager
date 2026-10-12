using System.Text.Json.Serialization;
namespace MealManager.Common.Enums;

[JsonConverter(typeof(SupermarketProviderJsonConverter))]
public enum SupermarketProvider { Picnic = 1 }

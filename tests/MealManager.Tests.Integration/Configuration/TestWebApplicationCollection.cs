using Xunit;

namespace MealManager.Tests.Integration.Configuration;

[CollectionDefinition(Name, DisableParallelization = true)]
public class TestWebApplicationCollection : ICollectionFixture<CustomWebApplicationFactory>
{
    public const string Name = "TestWebApplication";
}

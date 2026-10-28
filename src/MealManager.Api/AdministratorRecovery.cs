using System.Text;

namespace MealManager.Api;

internal static class AdministratorRecovery
{
    public static async Task Run(string email, PasswordCommands commands)
    {
        Console.Error.Write("Temporary password: ");
        var password = ReadPassword();
        await commands.RecoverAdministrator(email, password);
        Console.Error.WriteLine("Administrator recovered. Sign in with the temporary password and replace it. Existing sessions have been invalidated.");
    }

    private static string ReadPassword()
    {
        if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
        var password = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                Console.Error.WriteLine();
                return password.ToString();
            }
            if (key.Key == ConsoleKey.Backspace)
            {
                if (password.Length > 0) password.Length--;
            }
            else if (!char.IsControl(key.KeyChar))
            {
                password.Append(key.KeyChar);
            }
        }
    }
}

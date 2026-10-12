using MealManager.Common.Enums;
using MealManager.Domain.Contracts;
using Microsoft.AspNetCore.DataProtection;

namespace MealManager.Infrastructure.Supermarkets;

public sealed class PicnicSessions(ProviderSettingsStore store, PicnicGate gate, IPicnicApiClient client, IDataProtectionProvider protection)
{
    private readonly IDataProtector protector = protection.CreateProtector("MealManager.Supermarkets.Session.v1");
    public string Protect(string token) => protector.Protect(token);
    public PicnicAccess Access(PicnicSettings settings)
    {
        try { return new(protector.Unprotect(settings.ProtectedToken ?? ""), settings.CountryCode); }
        catch (System.Security.Cryptography.CryptographicException) { throw new SupermarketException(SupermarketFailure.SessionExpired); }
    }

    public async Task<T> Use<T>(SupermarketConnectionInfo expected, Func<IPicnicApiClient, PicnicAccess, Task<T>> action, CancellationToken ct, bool mutation = false)
    {
        await gate.Mutex.WaitAsync(ct);
        try
        {
            var json = await store.Read(SupermarketProvider.Picnic, ct);
            var settings = ProviderSettingsStore.Picnic(json);
            if (settings.ConnectionGeneration != expected.Generation || settings.AccountId != expected.AccountId)
                throw new SupermarketException(SupermarketFailure.ConnectionChanged);
            if (settings.Status != "Connected") throw new SupermarketException(SupermarketFailure.SessionExpired);
            var access = Access(settings);
            var originalToken = access.Token;
            var acknowledged = false;
            try
            {
                var result = await action(client, access);
                acknowledged = true;
                return result;
            }
            catch (SupermarketException ex) when (ex.Failure == SupermarketFailure.SessionExpired)
            {
                settings = settings with { Status = "ReconnectRequired" };
                throw;
            }
            finally
            {
                // Persist rotation/expiry explicitly, even if a response body or browser connection failed.
                using var cleanup = new CancellationTokenSource(SupermarketLimits.LocalSaveTimeout);
                if (access.Token != originalToken || settings.Status != "Connected")
                {
                    try { await store.Write(SupermarketProvider.Picnic, json, settings with { ProtectedToken = Protect(access.Token) }, cleanup.Token); }
                    catch (Exception ex) when (ex is Microsoft.EntityFrameworkCore.DbUpdateException or Microsoft.Data.Sqlite.SqliteException or System.Security.Cryptography.CryptographicException or OperationCanceledException or SupermarketException)
                    {
                        throw new SupermarketException(mutation ? acknowledged ? SupermarketFailure.LocalPersistence : SupermarketFailure.Uncertain : SupermarketFailure.Protocol);
                    }
                }
            }
        }
        finally { gate.Mutex.Release(); }
    }
}

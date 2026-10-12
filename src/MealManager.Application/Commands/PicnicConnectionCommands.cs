using MealManager.Application.Mapping;
using MealManager.Application.Supermarkets;
using MealManager.Common.Enums;
using MealManager.Domain.Contracts;
using MealManager.Infrastructure.Supermarkets;

namespace MealManager.Application.Commands;

public sealed class PicnicConnectionCommands(ProviderSettingsStore store, PicnicSessions sessions, IPicnicApiClient client, PicnicGate gate)
{
    public async Task<PicnicConnectionDto> Connect(Guid userId, ConnectPicnicDto command, CancellationToken ct)
    {
        await gate.Mutex.WaitAsync(ct);
        try
        {
            var json = await store.Read(SupermarketProvider.Picnic, ct);
            var previous = ProviderSettingsStore.Picnic(json);
            var changedCountry = previous.CountryCode != command.CountryCode;
            if (changedCountry && !command.ResetProductMappings)
                throw new InvalidOperationError(ErrorCodes.SupermarketSelectionInvalid, "Confirm resetting saved Picnic products before changing country.");
            var login = await client.Login(command.Email.Trim(), command.Password, command.CountryCode, ct);
            var settings = new PicnicSettings
            {
                CountryCode = command.CountryCode,
                ProtectedToken = sessions.Protect(login.Token),
                Status = login.VerificationRequired ? "VerificationRequired" : "Connected",
                VerificationUserId = login.VerificationRequired ? userId : null,
                VerificationExpiresAt = login.VerificationRequired ? DateTime.UtcNow.Add(PicnicProtocol.VerificationLifetime) : null,
            };
            if (!login.VerificationRequired) settings = await VerifyAccount(settings, new(login.Token, command.CountryCode), ct);
            await store.Write(SupermarketProvider.Picnic, json, settings, ct, changedCountry);
            return settings.ToDto();
        }
        catch (PicnicAuthenticationException ex) { throw AuthenticationError(ex); }
        catch (SupermarketException ex) { throw SupermarketProviders.Error(ex); }
        finally { gate.Mutex.Release(); }
    }

    public Task<PicnicConnectionDto> RequestCode(Guid userId, CancellationToken ct) =>
        Verification(userId, async (settings, access) =>
        {
            if (settings.CodeRequestedAt > DateTime.UtcNow.Subtract(PicnicProtocol.CodeCooldown))
                throw new InvalidOperationError(ErrorCodes.SupermarketAuthentication, "Wait before requesting another verification code.");
            await client.RequestCode(access, ct);
            return settings with { CodeRequestedAt = DateTime.UtcNow };
        }, ct);

    public Task<PicnicConnectionDto> Verify(Guid userId, VerifyPicnicDto command, CancellationToken ct) =>
        Verification(userId, async (settings, access) =>
        {
            await client.VerifyCode(access, command.Code, ct);
            return await VerifyAccount(settings, access, ct);
        }, ct);

    private async Task<PicnicConnectionDto> Verification(Guid userId, Func<PicnicSettings, PicnicAccess, Task<PicnicSettings>> action, CancellationToken ct)
    {
        await gate.Mutex.WaitAsync(ct);
        try
        {
            var json = await store.Read(SupermarketProvider.Picnic, ct);
            var settings = ProviderSettingsStore.Picnic(json);
            if (settings.Status != "VerificationRequired" || settings.VerificationUserId != userId ||
                settings.VerificationExpiresAt is null || settings.VerificationExpiresAt <= DateTime.UtcNow)
                throw new InvalidOperationError(ErrorCodes.SupermarketAuthentication, "Start a new supermarket connection before verifying.");
            var access = sessions.Access(settings);
            var originalToken = access.Token;
            try { settings = await action(settings, access); }
            finally
            {
                // Save a rotated token even when a later account lookup fails.
                if (access.Token != originalToken || settings.CodeRequestedAt is not null || settings.Status == "Connected")
                {
                    using var cleanup = new CancellationTokenSource(SupermarketLimits.LocalSaveTimeout);
                    await store.Write(SupermarketProvider.Picnic, json, settings with { ProtectedToken = sessions.Protect(access.Token) }, cleanup.Token);
                }
            }
            return settings.ToDto();
        }
        catch (PicnicAuthenticationException ex) { throw AuthenticationError(ex); }
        catch (SupermarketException ex) { throw SupermarketProviders.Error(ex); }
        finally { gate.Mutex.Release(); }
    }

    private async Task<PicnicSettings> VerifyAccount(PicnicSettings settings, PicnicAccess access, CancellationToken ct)
    {
        var account = await client.GetAccount(access, ct);
        return settings with
        {
            ProtectedToken = sessions.Protect(access.Token),
            AccountId = account.Id,
            AccountLabel = account.Label,
            Status = "Connected",
            VerificationExpiresAt = null,
            VerificationUserId = null,
            CodeRequestedAt = null,
        };
    }

    public async Task Disconnect(CancellationToken ct)
    {
        await gate.Mutex.WaitAsync(ct);
        try
        {
            var json = await store.Read(SupermarketProvider.Picnic, ct);
            // Reset is available even when a stored document is corrupt or no longer supported.
            var country = "NL";
            try { country = ProviderSettingsStore.Picnic(json).CountryCode; }
            catch (InvalidOperationError) { }
            await store.Write(SupermarketProvider.Picnic, json, new PicnicSettings { CountryCode = country }, ct);
        }
        catch (SupermarketException ex) { throw SupermarketProviders.Error(ex); }
        finally { gate.Mutex.Release(); }
    }

    private static InvalidOperationError AuthenticationError(PicnicAuthenticationException ex) => new(ErrorCodes.SupermarketAuthentication,
        ex.Failure == PicnicAuthenticationFailure.Credentials ? "Check your supermarket email and password." : "The verification code is invalid. Try again or request a new code.");
}

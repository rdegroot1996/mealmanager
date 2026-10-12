# Picnic integration

Unofficial integration with Picnic’s private API. See [shopping behavior](functional-overview.md#optional-supermarket-handoff) and [integration architecture](README.md#supermarket-integrations).

## Connection

Administrators connect the shared household account in **Settings → Supermarket integrations**, using email, password, and SMS verification. Supported countries: Netherlands, Germany, France. Passwords are not stored.

Changing country clears saved product choices after confirmation; same-country reconnection preserves them. SMS verification expires after ten minutes, with a thirty-second resend cooldown. Reconnect expired sessions from Settings.

## Protocol

[PicnicProtocol](../src/MealManager.Infrastructure/Supermarkets/PicnicProtocol.cs) defines the protocol constants; [SupermarketLimits](../src/MealManager.Infrastructure/Supermarkets/SupermarketLimits.cs) defines timeouts. Proxies must allow the sixty-second export budget.

Authenticated requests are serialized to handle token rotation. Cart additions require an acknowledgement containing the requested article; ambiguous responses never check groceries or trigger automatic retries. The adapter does not reconcile existing cart quantities.

# MealManager MCP reference

Optional Streamable HTTP tools at `/mcp` let a personal AI client work with household recipes, meal plans, groceries, and Shopping lists.

## Configuration

Set `Mcp__Enabled=true` and `Mcp__AccessToken=<random secret of at least 32 characters>`, then restart. Clients send `Authorization: Bearer <token>`; invalid credentials receive `401 Unauthorized`. See the [Compose example](../docker-compose.example.yml).

The token grants household read/write access independently of web accounts. Store it as a deployment secret, keep the endpoint private, and use HTTPS across untrusted networks. Rotate it to revoke access.

## Client behavior

[Server instructions](../src/MealManager.Api/Mcp/Instructions.md) define discovery, proposals, approval, and write recovery. The server sends them at initialization; tool schemas describe arguments and response contracts. Shared product rules live in the [functional overview](functional-overview.md#personal-ai-integration).

## Verification

Against a running instance:

```powershell
./scripts/Test-McpEndpoint.ps1 -Url http://127.0.0.1:8080/mcp -Token $env:MEALMANAGER_MCP_TOKEN
```

Add `-ExerciseWrites` only for isolated data; it persists recipes, plans, and shopping items. For an isolated Docker build, workflow checks, and restart persistence:

```powershell
./scripts/Test-McpDocker.ps1
```

The script removes its temporary container and volume. Protocol tests verify contracts and persistence; client interpretation and user approval remain AI-client responsibilities.

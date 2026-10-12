# Deployment

[Project](../README.md) · [Technical guide](README.md)

## Docker

For a Compose deployment, copy [`docker-compose.example.yml`](../docker-compose.example.yml) to `docker-compose.yml`, select either direct trusted HTTP or a reverse-proxy connection as described in its comments, then start it:

```powershell
docker compose up -d
```

The example uses a named Docker volume by default. Uncomment its bind-mount alternative when you prefer the data directory to be directly visible on the host.

Release tags publish matching image tags and `latest`.
Manual builds use the selected branch or tag name, such as `main`.
Set `MEALMANAGER_IMAGE` to a tag or digest to pin a deployment.
Run [checks locally](development.md#verify-changes) while pipeline validation is deferred.

To build and run the image directly instead, use:

```powershell
docker build -f src/MealManager.Api/Dockerfile -t mealmanager .
docker volume create mealmanager-data
docker run --name mealmanager -p 8080:8080 `
  -v mealmanager-data:/app/data `
  -e Authentication__AllowInsecureHttp=true `
  mealmanager
```

Then open `http://localhost:8080`.

The example enables HTTP for a trusted local network. For normal deployment, put the container behind an HTTPS reverse proxy and omit `Authentication__AllowInsecureHttp`. See the [security settings](README.md#authentication-and-http-security) for proxy configuration.

## Storage and backup

The [Dockerfile](../src/MealManager.Api/Dockerfile) builds the frontend and API and exposes port `8080`. Optional AI access uses the [MCP configuration](mcp-clients.md#configuration).

Persist `/app/data` containing `meal-manager.db`, `recipe-images`, and `data-protection-keys`. `Storage__DataRoot` overrides the root. Preserving keys keeps valid sessions across restarts.

For backup, stop the container and copy the complete data volume; restore it as one unit. Live file-by-file copies are inconsistent.

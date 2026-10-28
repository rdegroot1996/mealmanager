# Stage 1: Build the frontend
FROM node:24-slim AS frontend
WORKDIR /src/MealManager.App
COPY src/MealManager.App/package*.json ./
RUN npm ci
COPY src/MealManager.App/ ./
RUN npm run build

# Stage 2: Build the backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY . ./
RUN dotnet publish "src/MealManager.Api/MealManager.Api.csproj" -c Release -o /app/publish
RUN mkdir -p /app/publish/data

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
EXPOSE 8080
WORKDIR /app
COPY --from=backend /app/publish .
COPY --from=frontend /src/MealManager.App/dist/mealmanager/browser ./wwwroot
ENTRYPOINT ["dotnet", "MealManager.Api.dll"]

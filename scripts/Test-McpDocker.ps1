#requires -Version 7.0
param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot
$image = 'mealmanager-mcp-verification:local'
$name = "mealmanager-mcp-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$volume = "$name-data"
$previousToken = $env:Mcp__AccessToken
$env:Mcp__AccessToken = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($args[0])" }
}

function Wait-Application {
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        try {
            $response = Invoke-WebRequest "$baseUrl/api/config" -TimeoutSec 3 -SkipHttpErrorCheck
            if ($response.StatusCode -eq 200) { return }
        }
        catch { }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'The Docker application did not become ready.'
}

try {
    if (-not $SkipBuild) {
        Invoke-Docker build --file "$repository/src/MealManager.Api/Dockerfile" --tag $image $repository
    }
    Invoke-Docker volume create $volume | Out-Null
    Invoke-Docker run --detach --name $name --publish '127.0.0.1::8080' --mount "type=volume,source=$volume,target=/app/data" `
        --env 'Mcp__Enabled=true' --env Mcp__AccessToken --env 'Authentication__AllowInsecureHttp=true' $image | Out-Null
    $port = (Invoke-Docker port $name '8080/tcp').Trim().Split(':')[-1]
    $baseUrl = "http://127.0.0.1:$port"
    Wait-Application
    $frontend = Invoke-WebRequest $baseUrl
    if ($frontend.Content -notlike '*<app-root*') { throw 'The compiled Angular frontend was not served.' }
    $bundle = [regex]::Match($frontend.Content, 'src="([^"]*main[^"]*\.js)"').Groups[1].Value
    if (-not $bundle -or (Invoke-WebRequest "$baseUrl/$bundle").StatusCode -ne 200) {
        throw 'The Angular application bundle was not served.'
    }
    Write-Output 'PASS: production Docker image serves Angular and the API.'
    & "$PSScriptRoot/Test-McpEndpoint.ps1" -Url "$baseUrl/mcp" -Token $env:Mcp__AccessToken -ExerciseWrites

    Invoke-Docker restart $name | Out-Null
    $port = (Invoke-Docker port $name '8080/tcp').Trim().Split(':')[-1]
    $baseUrl = "http://127.0.0.1:$port"
    Wait-Application
    # Dot-sourcing the read-only check establishes a fresh MCP session for persistence reads.
    . "$PSScriptRoot/Test-McpEndpoint.ps1" -Url "$baseUrl/mcp" -Token $env:Mcp__AccessToken
    $mealPlan = Send-McpRequest 'tools/call' @{ name = 'get_active_meal_plan'; arguments = @{} }
    $recipes = Send-McpRequest 'tools/call' @{ name = 'list_recipe_catalog'; arguments = @{} }
    if (@($mealPlan.result.structuredContent.mealPlan.entries).Count -ne 1 -or
        $recipes.result.structuredContent.totalCount -ne 2) {
        throw 'MCP data did not survive the container restart.'
    }
    $previousCycleId = $mealPlan.result.structuredContent.cycle.previousPlanningCycleId
    $shopping = Send-McpRequest 'tools/call' @{ name = 'get_shopping_list'; arguments = @{ cycleId = $previousCycleId } }
    $reviewedGroups = @($shopping.result.structuredContent.mealGroups)
    if ($reviewedGroups.Count -ne 1 -or @($reviewedGroups[0].items).Count -ne 0) {
        throw 'Historical shopping data did not survive the container restart.'
    }
    Write-Output 'PASS: recipes, active meal plan and historical shopping survive restart.'
}
finally {
    & docker rm --force $name 2>$null | Out-Null
    & docker volume rm $volume 2>$null | Out-Null
    $env:Mcp__AccessToken = $previousToken
}

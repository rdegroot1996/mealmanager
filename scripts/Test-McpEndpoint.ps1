#requires -Version 7.0
param(
    [Parameter(Mandatory = $true)]
    [uri]$Url,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [switch]$ExerciseWrites
)

$ErrorActionPreference = 'Stop'
$requestId = 0
$sessionId = $null
$baseHeaders = @{
    Accept = 'application/json, text/event-stream'
    'MCP-Protocol-Version' = '2025-11-25'
}

function Send-McpRequest {
    param(
        [string]$Method,
        [object]$Parameters,
        [switch]$Notification,
        [string]$ExpectedError
    )

    $body = @{
        jsonrpc = '2.0'
        method = $Method
        params = $Parameters
    }
    if (-not $Notification) {
        $script:requestId++
        $body.id = $script:requestId
    }

    $headers = $baseHeaders.Clone()
    $headers.Authorization = "Bearer $Token"
    if ($script:sessionId) {
        $headers['Mcp-Session-Id'] = $script:sessionId
    }

    $response = Invoke-WebRequest -Uri $Url -Method Post -Headers $headers `
        -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 20 -Compress) `
        -SkipHttpErrorCheck
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "$Method returned HTTP $($response.StatusCode): $($response.Content)"
    }
    if ($response.Headers.ContainsKey('Mcp-Session-Id')) {
        $script:sessionId = $response.Headers['Mcp-Session-Id'] | Select-Object -First 1
    }
    if ($Notification) {
        return
    }

    $content = $response.Content
    if ($content.StartsWith('event:')) {
        $dataLine = [regex]::Match($content, '(?m)^data: (.+)\r?$')
        if (-not $dataLine.Success) {
            throw "$Method returned an SSE response without a data line."
        }
        $content = $dataLine.Groups[1].Value
    }
    $message = $content | ConvertFrom-Json -AsHashtable
    if ($message.error) {
        throw "$Method returned JSON-RPC error: $($message.error | ConvertTo-Json -Compress)"
    }
    if ($ExpectedError) {
        if (-not $message.result.isError -or $message.result.content[0].text -notlike "*$ExpectedError*") {
            throw "Expected $ExpectedError from $Method."
        }
        return $message
    }
    if ($message.result.isError) {
        throw "$Method returned an MCP tool error: $($message.result | ConvertTo-Json -Depth 10 -Compress)"
    }
    return $message
}

$initializeBody = @{
    jsonrpc = '2.0'
    id = 0
    method = 'initialize'
    params = @{
        protocolVersion = '2025-11-25'
        capabilities = @{}
        clientInfo = @{ name = 'MealManager HTTP smoke test'; version = '1.0' }
    }
} | ConvertTo-Json -Depth 10 -Compress

foreach ($authorization in @($null, 'Bearer invalid-token')) {
    $headers = $baseHeaders.Clone()
    if ($authorization) {
        $headers.Authorization = $authorization
    }
    $response = Invoke-WebRequest -Uri $Url -Method Post -Headers $headers `
        -ContentType 'application/json' -Body $initializeBody -SkipHttpErrorCheck
    if ($response.StatusCode -ne 401) {
        throw "Expected HTTP 401 without a valid bearer token; received $($response.StatusCode)."
    }
}
Write-Output 'PASS: missing and invalid bearer tokens are rejected.'

$initialized = Send-McpRequest 'initialize' @{
    protocolVersion = '2025-11-25'
    capabilities = @{}
    clientInfo = @{ name = 'MealManager HTTP smoke test'; version = '1.0' }
}
if ($initialized.result.serverInfo.name -ne 'mealmanager') {
    throw 'The MCP endpoint did not identify itself as mealmanager.'
}
Send-McpRequest 'notifications/initialized' @{} -Notification
$listed = Send-McpRequest 'tools/list' @{}
$toolNames = @($listed.result.tools | ForEach-Object { $_.name })
foreach ($requiredTool in @('create_recipe', 'update_recipe', 'list_recipe_catalog', 'list_recipe_tags',
        'search_recipes', 'get_active_planning', 'create_planning_cycle', 'apply_planning', 'add_grocery_item', 'get_grocery_list', 'remove_grocery_item')) {
    if ($requiredTool -notin $toolNames) {
        throw "The MCP endpoint did not advertise $requiredTool."
    }
}
if ('list_ingredients' -in $toolNames -or
    $listed.result.tools.Where({ $_.name -eq 'search_recipes' })[0].inputSchema.properties.ContainsKey('availableIngredients')) {
    throw 'Obsolete ingredient-matching tools or parameters are still advertised.'
}
if ($initialized.result.instructions -notlike '*explicit user confirmation*') {
    throw 'Draft-first import instructions are missing.'
}
Write-Output 'PASS: authenticated MCP initialization and final tool discovery.'

if (-not $ExerciseWrites) {
    return
}

$existingPlanning = Send-McpRequest 'tools/call' @{ name = 'get_active_planning'; arguments = @{} }
if ($existingPlanning.result.structuredContent.cycle) {
    throw 'Write smoke test requires an isolated database without an existing planning cycle.'
}

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$recipeName = "MCP smoke vegetable mince $suffix"
$created = Send-McpRequest 'tools/call' @{
    name = 'create_recipe'
    arguments = @{
        name = $recipeName
        category = 'Meals'
        baseServings = 2
        tags = @('smoke-test', 'Easy')
        ingredients = @(
            @{ name = 'Ground meat'; quantity = 300; unit = 'g' },
            @{ name = 'Carrots'; quantity = 2; unit = 'pcs' },
            @{ name = 'Capsicum'; quantity = 1; unit = 'pcs' }
        )
        steps = @('Cook the ingredients.')
    }
}
$recipeId = $created.result.structuredContent.id
$profileId = $created.result.structuredContent.profiles[0].id
Send-McpRequest 'tools/call' @{
    name = 'update_recipe_profile'
    arguments = @{
        profileId = $profileId
        expectedProfileVersion = (Send-McpRequest 'tools/call' @{ name = 'get_recipe_profile'; arguments = @{ profileId = $profileId } }).result.structuredContent.profileVersion
        products = @(
            @{ name = 'Minced meat pack'; quantity = 1; atHome = $false },
            @{ name = 'Salt'; quantity = 1; atHome = $true }
        )
    }
} | Out-Null
$profile = Send-McpRequest 'tools/call' @{ name = 'get_recipe_profile'; arguments = @{ profileId = $profileId } }
if (@($profile.result.structuredContent.products).Count -ne 2 -or
    -not $profile.result.structuredContent.products[1].atHome) {
    throw 'The confirmed Default profile products were not persisted.'
}
$recipeName = "$recipeName edited"
Send-McpRequest 'tools/call' @{
    name = 'update_recipe'
    arguments = @{ recipeId = $recipeId; expectedRecipeVersion = $created.result.structuredContent.recipeVersion; name = $recipeName; tags = @('smoke-test', 'Easy', 'Freezable') }
} | Out-Null
Send-McpRequest 'tools/call' @{ name = 'create_recipe'; arguments = @{
    name = "MCP smoke easy soup $suffix"; category = 'Meals'; baseServings = 2; tags = @('Easy')
    ingredients = @(@{ name = 'Tomatoes'; quantity = 400; unit = 'g' }); steps = @('Simmer tomatoes.')
} } | Out-Null
$catalog = Send-McpRequest 'tools/call' @{ name = 'list_recipe_catalog'; arguments = @{} }
$labels = Send-McpRequest 'tools/call' @{ name = 'list_recipe_tags'; arguments = @{} }
if ($catalog.result.structuredContent.totalCount -ne 2 -or
    'Freezable' -notin @($labels.result.structuredContent.tags | ForEach-Object { $_.name })) {
    throw 'Recipe catalog or known labels did not include the edited recipe.'
}
$search = Send-McpRequest 'tools/call' @{
    name = 'search_recipes'
    arguments = @{
        search = $recipeName
        tags = @('Freezable')
        sort = 'Name'
    }
}
$match = @($search.result.structuredContent.recipes | Where-Object { $_.id -eq $recipeId })
if ($match.Count -ne 1 -or $match[0].ContainsKey('matchedIngredients')) {
    throw 'SQL recipe search failed or still exposes literal ingredient matching.'
}
$updatedRecipe = Send-McpRequest 'tools/call' @{ name = 'get_recipe'; arguments = @{ recipeId = $recipeId } }
Send-McpRequest 'tools/call' @{ name = 'update_recipe'; arguments = @{
    recipeId = $recipeId; expectedRecipeVersion = $created.result.structuredContent.recipeVersion; name = 'Stale proposal'
} } -ExpectedError 'RecipeChanged' | Out-Null
$currentProfile = $profile.result.structuredContent
Send-McpRequest 'tools/call' @{ name = 'update_recipe_profile'; arguments = @{
    profileId = $profileId; expectedProfileVersion = $currentProfile.profileVersion
    products = @(@{ id = [guid]::NewGuid().ToString(); name = 'Unknown product'; quantity = 1 })
} } -ExpectedError 'ValidationError' | Out-Null
$freezable = Send-McpRequest 'tools/call' @{ name = 'list_recipe_catalog'; arguments = @{ tags = @('Easy', 'Freezable') } }
if ($freezable.result.structuredContent.totalCount -ne 1 -or
    'Capsicum' -notin @($freezable.result.structuredContent.recipes[0].ingredients | ForEach-Object { $_.name }) -or
    'Ground meat' -notin @($freezable.result.structuredContent.recipes[0].ingredients | ForEach-Object { $_.name })) {
    throw 'Filtered catalog did not provide ingredients for client synonym interpretation.'
}
Write-Output 'PASS: confirmed recipe/Default products, editing, catalog/labels, SQL search and stale/invalid edit rejection.'

$cycleStart = [DateTime]::Today.AddDays((9 - [int][DateTime]::Today.DayOfWeek) % 7)
$startDate = $cycleStart.ToString('yyyy-MM-dd')
$endDate = $cycleStart.AddDays(6).ToString('yyyy-MM-dd')
$bulk = Send-McpRequest 'tools/call' @{
    name = 'create_recipe_profile'
    arguments = @{ recipeId = $recipeId; name = 'Bulk'; servings = 8 }
}
$bulkId = $bulk.result.structuredContent.id
$cycle = Send-McpRequest 'tools/call' @{
    name = 'create_planning_cycle'
    arguments = @{
        startDate = $startDate; endDate = $endDate
        expectedPlanningVersion = $existingPlanning.result.structuredContent.planningVersion
        entries = @(
            @{ clientKey = 'cook'; kind = 'Meal'; date = $cycleStart.AddDays(2).ToString('yyyy-MM-dd'); recipeId = $recipeId; profileId = $bulkId },
            @{ clientKey = 'leftover'; kind = 'Leftover'; date = $cycleStart.AddDays(3).ToString('yyyy-MM-dd'); originalMealKey = 'cook' },
            @{ clientKey = 'prep'; kind = 'Meal'; date = $cycleStart.AddDays(4).ToString('yyyy-MM-dd'); recipeId = $recipeId; profileId = $bulkId }
        )
        notes = @(
            @{ clientKey = 'out'; date = $cycleStart.AddDays(1).ToString('yyyy-MM-dd'); text = 'Eating out' },
            @{ clientKey = 'freezer'; date = $cycleStart.AddDays(4).ToString('yyyy-MM-dd'); text = 'Dinner and four extra portions for the freezer' }
        )
    }
}
$savedCycle = $cycle.result.structuredContent
if ($savedCycle.startDate -ne $startDate -or $savedCycle.endDate -ne $endDate -or
    @($savedCycle.planning.entries).Count -ne 3 -or @($savedCycle.planning.notes).Count -ne 2) {
    throw 'The complete proposed cycle was not returned with its inclusive date range.'
}
$beforeGroceries = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{} }
if (@($beforeGroceries.result.structuredContent.groceries).Count -ne 0 -or
    @($beforeGroceries.result.structuredContent.planningMealGroceries).Count -ne 0) {
    throw 'Planning unexpectedly added groceries.'
}
$ids = $savedCycle.createdIds
$corrected = Send-McpRequest 'tools/call' @{
    name = 'apply_planning'
    arguments = @{
        cycleId = $savedCycle.id; expectedPlanningVersion = $savedCycle.planningVersion
        entries = @(
            @{ id = $ids.cook; kind = 'Meal'; date = $cycleStart.AddDays(2).ToString('yyyy-MM-dd'); recipeId = $recipeId; profileId = $bulkId },
            @{ id = $ids.leftover; kind = 'Leftover'; date = $cycleStart.AddDays(3).ToString('yyyy-MM-dd'); originalMealId = $ids.cook },
            @{ id = $ids.prep; kind = 'Meal'; date = $cycleStart.AddDays(5).ToString('yyyy-MM-dd'); recipeId = $recipeId; profileId = $bulkId }
        )
        notes = @(
            @{ id = $ids.out; date = $cycleStart.AddDays(1).ToString('yyyy-MM-dd'); text = 'Eating out with friends' },
            @{ id = $ids.freezer; date = $cycleStart.AddDays(5).ToString('yyyy-MM-dd'); text = 'Dinner and four extra portions for the freezer' }
        )
    }
}
$readback = Send-McpRequest 'tools/call' @{ name = 'get_active_planning'; arguments = @{} }
if ($readback.result.structuredContent.planningVersion -ne $corrected.result.structuredContent.planningVersion -or
    $readback.result.structuredContent.planning.entries[2].date -ne $cycleStart.AddDays(5).ToString('yyyy-MM-dd')) {
    throw 'The corrected planning did not persist.'
}
Send-McpRequest 'tools/call' @{
    name = 'review_meal_groceries'
    arguments = @{ planningMealId = $ids.cook; groceries = @() }
} | Out-Null
Write-Output 'PASS: complete Tuesday-Monday planning, linked leftovers, bulk profile, corrections and explicit empty grocery review.'
$groceryName = "MCP smoke milk $suffix"
$added = Send-McpRequest 'tools/call' @{
    name = 'add_grocery_item'
    arguments = @{ name = $groceryName; quantity = 2 }
}
$manualId = $added.result.structuredContent.id
Send-McpRequest 'tools/call' @{ name = 'update_grocery_item'; arguments = @{
    groceryItemId = $manualId; name = $groceryName; quantity = 3; isChecked = $true
} } | Out-Null
$list = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{} }
$groceries = @($list.result.structuredContent.groceries | Where-Object { $_.id -eq $manualId })
if ($groceries.Count -ne 1 -or $groceries[0].quantity -ne 3 -or -not $groceries[0].checked) {
    throw 'The edited manual shopping item was not returned.'
}
$mealReview = Send-McpRequest 'tools/call' @{ name = 'review_meal_groceries'; arguments = @{
    planningMealId = $ids.cook; groceries = @(@{ name = 'Meal meat'; quantity = 1 }, @{ name = 'Meal carrots'; quantity = 1 })
} }
$removedMealGroceryId = $mealReview.result.structuredContent.groceries[0].id
$mealGroceryId = $mealReview.result.structuredContent.groceries[1].id
$list = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{} }
$group = $list.result.structuredContent.planningMealGroceries[0]
if ($group.planningMeal.id -ne $ids.cook -or $group.planningMeal.recipeName -ne $recipeName -or
    $group.planningMeal.date -ne $cycleStart.AddDays(2).ToString('yyyy-MM-dd') -or
    $group.groceries[0].planningMealId -ne $ids.cook) {
    throw 'Shopping did not clearly identify the recipe and original meal date.'
}
Send-McpRequest 'tools/call' @{ name = 'remove_grocery_item'; arguments = @{ groceryItemId = $removedMealGroceryId } } | Out-Null
Send-McpRequest 'tools/call' @{ name = 'remove_grocery_item'; arguments = @{ groceryItemId = $manualId } } | Out-Null
$list = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{} }
if (@($list.result.structuredContent.groceries).Count -ne 0 -or
    $list.result.structuredContent.planningMealGroceries[0].groceries[0].id -ne $mealGroceryId) {
    throw 'Removal did not preserve the other meal item or failed to remove the manual item.'
}
Write-Output 'PASS: shopping identifies meal recipe/date; manual and meal-item removal preserve other groceries.'

$prior = Send-McpRequest 'tools/call' @{ name = 'get_active_planning'; arguments = @{} }
$nextStart = $cycleStart.AddDays(7)
$nextCycle = Send-McpRequest 'tools/call' @{ name = 'create_planning_cycle'; arguments = @{
    startDate = $nextStart.ToString('yyyy-MM-dd'); endDate = $nextStart.AddDays(6).ToString('yyyy-MM-dd')
    expectedPlanningVersion = $prior.result.structuredContent.planningVersion
    entries = @(@{ clientKey = 'easy'; kind = 'Meal'; date = $nextStart.ToString('yyyy-MM-dd'); recipeId = $recipeId; profileId = $profileId })
    notes = @(@{ clientKey = 'out'; date = $nextStart.AddDays(1).ToString('yyyy-MM-dd'); text = 'Eating out' })
} }
Send-McpRequest 'tools/call' @{ name = 'plan_meal'; arguments = @{
    cycleId = $savedCycle.id; recipeId = $recipeId; profileId = $profileId; date = $startDate
} } -ExpectedError 'HistoricalCycleReadOnly' | Out-Null
$historicalShopping = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{ cycleId = $savedCycle.id } }
if ($historicalShopping.result.structuredContent.planningMealGroceries[0].groceries[0].id -ne $mealGroceryId -or
    $nextCycle.result.structuredContent.startDate -ne $nextStart.ToString('yyyy-MM-dd')) {
    throw 'Next cycle or historical shopping retrieval failed.'
}
Write-Output 'PASS: next Tuesday-Monday cycle, retained historical shopping and rejected historical planning writes.'
Send-McpRequest 'tools/call' @{ name = 'remove_grocery_item'; arguments = @{ groceryItemId = $mealGroceryId } } | Out-Null
$historicalShopping = Send-McpRequest 'tools/call' @{ name = 'get_grocery_list'; arguments = @{ cycleId = $savedCycle.id } }
$reviewedGroups = @($historicalShopping.result.structuredContent.planningMealGroceries)
if ($reviewedGroups.Count -ne 1 -or $reviewedGroups[0].planningMeal.id -ne $ids.cook -or
    @($reviewedGroups[0].groceries).Count -ne 0) {
    throw 'Removing the final historical meal item did not preserve its reviewed group.'
}
Write-Output 'PASS: final meal-item removal preserves an empty reviewed group in historical shopping.'

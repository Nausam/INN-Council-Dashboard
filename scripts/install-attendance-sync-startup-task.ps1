$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalCheck = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this installer from an Administrator PowerShell window."
}

$taskName = "HR Dashboard Attendance Sync"
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $PSScriptRoot "attendance-sync-runner.mjs"
$nodeExecutable = Join-Path $env:ProgramFiles "nodejs\node.exe"

if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory "node_modules\tsx\dist\cli.mjs"))) {
  throw "Install project dependencies first: npm ci"
}
if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory ".env.local"))) {
  throw "The project needs a configured .env.local file."
}
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
  throw "Node.js is missing at $nodeExecutable"
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and $existing.State -eq "Running") {
  Stop-ScheduledTask -TaskName $taskName
}

$action = New-ScheduledTaskAction `
  -Execute $nodeExecutable `
  -Argument ('--import tsx "' + $runner + '"') `
  -WorkingDirectory $projectDirectory
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn
$systemPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger @($startupTrigger, $logonTrigger) `
  -Principal $systemPrincipal `
  -Settings $settings `
  -Description "Runs the HR dashboard attendance sync worker at boot and restarts it after failures." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State

param(
  [string]$StageDir = 'C:\Temp\crm_stage_manual',
  [string]$TargetDir = 'C:\Program Files\iisnode\www\crm'
)

$ErrorActionPreference = 'Stop'

foreach ($varName in @('StageDir', 'TargetDir')) {
  $value = (Get-Variable -Name $varName -ValueOnly)
  if ($value -is [string]) {
    $trimmed = $value.Trim()
    if (($trimmed.StartsWith("'") -and $trimmed.EndsWith("'")) -or ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"'))) {
      Set-Variable -Name $varName -Value $trimmed.Substring(1, $trimmed.Length - 2)
    }
  }
}

function Invoke-RobocopySafe {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$RoboArgs = @('/E')
  )

  & robocopy $Source $Destination @RoboArgs | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE for $Source -> $Destination"
  }
}

$distStage = Join-Path $StageDir 'dist'
$serverStage = Join-Path $StageDir 'server'
$serverTarget = Join-Path $TargetDir 'server'
$webConfigStage = Join-Path $StageDir 'web.config'
$webConfigTarget = Join-Path $TargetDir 'web.config'
$backupDir = Join-Path 'C:\Temp' ("crm_backup_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))

if (!(Test-Path $distStage)) {
  throw "Stage dist directory not found: $distStage"
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

if (Test-Path $TargetDir) {
  Invoke-RobocopySafe -Source $TargetDir -Destination (Join-Path $backupDir 'crm') -RoboArgs @('/MIR')
}

# /MIR แต่ preserve ไดเรกทอรี backend ที่ frontend ไม่ควรแตะ
Invoke-RobocopySafe -Source $distStage -Destination $TargetDir -RoboArgs @('/MIR', '/XD', 'node_modules', 'server', 'iisnode-logs', '/XF', '.env', 'web.config', 'package.json', 'package-lock.json')

if (Test-Path $serverStage) {
  New-Item -ItemType Directory -Force -Path $serverTarget | Out-Null
  Invoke-RobocopySafe -Source $serverStage -Destination $serverTarget -RoboArgs @('/MIR', '/XD', 'node_modules', 'iisnode-logs', '/XF', '.env')
}

if (Test-Path $webConfigStage) {
  Copy-Item $webConfigStage $webConfigTarget -Force
}

[PSCustomObject]@{
  backupDir = $backupDir
  targetDir = $TargetDir
  indexHtml = (Test-Path (Join-Path $TargetDir 'index.html'))
} | ConvertTo-Json -Depth 3

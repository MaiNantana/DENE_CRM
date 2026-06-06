param(
  [string]$ZipPath = "$PSScriptRoot\crm-dist.zip",
  [string]$TargetDir = 'C:\Program Files\iisnode\www\crm'
)

$ErrorActionPreference = 'Stop'

function Invoke-RobocopySafe {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$Args = @('/E')
  )

  & robocopy $Source $Destination @Args | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE for $Source -> $Destination"
  }
}

if (!(Test-Path $ZipPath)) {
  throw "Zip file not found: $ZipPath"
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$stageDir = Join-Path 'C:\Temp' "crm_zip_stage_$stamp"
$backupDir = Join-Path 'C:\Temp' "crm_backup_$stamp"

New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

Expand-Archive -Path $ZipPath -DestinationPath $stageDir -Force

if (Test-Path $TargetDir) {
  Invoke-RobocopySafe -Source $TargetDir -Destination (Join-Path $backupDir 'crm') -Args @('/MIR')
}

Invoke-RobocopySafe -Source $stageDir -Destination $TargetDir -Args @('/MIR')

$serverStage = Join-Path $stageDir 'server'
$serverTarget = Join-Path $TargetDir 'server'
if (Test-Path $serverStage) {
  New-Item -ItemType Directory -Force -Path $serverTarget | Out-Null
  Invoke-RobocopySafe -Source $serverStage -Destination $serverTarget -Args @('/MIR', '/XD', 'node_modules', 'iisnode-logs', '/XF', '.env')
}

$webConfigStage = Join-Path $stageDir 'web.config'
if (Test-Path $webConfigStage) {
  Copy-Item $webConfigStage (Join-Path $TargetDir 'web.config') -Force
}

[PSCustomObject]@{
  zipPath = $ZipPath
  targetDir = $TargetDir
  backupDir = $backupDir
  indexHtml = (Test-Path (Join-Path $TargetDir 'index.html'))
} | ConvertTo-Json -Depth 3

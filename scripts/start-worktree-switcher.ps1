# Start the bootstrap Vite dev server for the worktree-switcher
# in a new headed PowerShell window. Logs to headed-5173.log.
$workingDir = 'C:\Users\forianzsiga\Documents\elszamolos\.worktrees\worktree-switcher'
$logPath = Join-Path $workingDir 'headed-5173.log'
"$(Get-Date -Format o) starting bootstrap Vite in $workingDir" | Out-File -FilePath $logPath -Encoding utf8

$args = @(
  '-NoExit',
  '-Command',
  "cd '$workingDir'; npm run dev -- --host 127.0.0.1 --port 5173 2>&1 | Tee-Object -FilePath '$logPath' -Append"
)
Start-Process -FilePath 'powershell.exe' -ArgumentList $args
Start-Sleep -Seconds 1
"$(Get-Date -Format o) launched. Waiting for Vite to bind 5173..." | Out-File -FilePath $logPath -Append

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$remaining = Get-Process node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Output "STILL ALIVE after kill:"
    $remaining | Format-Table Id,ProcessName -AutoSize | Out-String | Write-Output
} else {
    Write-Output "All node processes killed."
}
# Also show what is listening on 5173/5174
Write-Output "---"
Write-Output "Listening sockets:"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 5173,5174,5175,5176,5177 } |
    Format-Table LocalAddress,LocalPort,OwningProcess -AutoSize |
    Out-String | Write-Output

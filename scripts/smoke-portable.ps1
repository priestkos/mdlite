$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NativeWindow {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
'@
New-Item -ItemType Directory -Force evidence | Out-Null
$exe = (Get-ChildItem release/mdlite-*-windows-x64.exe | Select-Object -First 1).FullName
$launcher = Start-Process $exe -PassThru
$deadline = (Get-Date).AddSeconds(90)
$window = $null
try {
    do {
        Start-Sleep -Milliseconds 500
        $window = Get-Process | Where-Object {
            $_.MainWindowTitle -like '* — mdlite' -and $_.MainWindowHandle -ne 0
        } | Select-Object -First 1
    } while (-not $window -and (Get-Date) -lt $deadline)
    if (-not $window) { throw 'Portable launcher did not show the mdlite editor within 90 seconds.' }
    [NativeWindow]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
    Start-Sleep -Seconds 2
    $rect = New-Object NativeWindow+RECT
    if (-not [NativeWindow]::GetWindowRect($window.MainWindowHandle, [ref]$rect)) { throw 'Could not measure editor window.' }
    $bitmap = New-Object System.Drawing.Bitmap(($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top))
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
        $bitmap.Save((Join-Path (Get-Location) 'evidence/windows-portable.png'))
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
    "Portable editor title: $($window.MainWindowTitle)" | Tee-Object evidence/portable-smoke.txt
    $window.CloseMainWindow() | Out-Null
    if (-not $window.WaitForExit(15000)) { throw 'Portable editor did not close cleanly.' }
    # NSIS removes its extracted files after the editor exits; let the launcher
    # finish instead of racing taskkill against a normally exiting process tree.
    if (-not $launcher.WaitForExit(30000)) { throw 'Portable launcher did not finish cleanup.' }
} finally {
    if (-not $launcher.HasExited) {
        Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue
    }
}

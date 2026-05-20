@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   GM Ext Packager
echo ========================================
echo.

set CONFIRM=
set /p CONFIRM=Pack? (Y/N):
if /i not "%CONFIRM%"=="Y" goto end

if exist "GMHelper.zip" del /q "GMHelper.zip"

echo Packing...
powershell -NoProfile -Command "Compress-Archive -Path manifest.json,background.js,content_script.js,panel.html,panel.js,popup.html,styles.css,commands.json,devtools.html,updates.xml -DestinationPath 'GMHelper.zip' -Force"

if exist "GMHelper.zip" (
    for %%A in (GMHelper.zip) do echo Done: GMHelper.zip [%%~zA bytes]
) else (
    echo Failed!
)
echo.

:end
pause

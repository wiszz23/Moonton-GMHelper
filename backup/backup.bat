@echo off
chcp 65001 >nul 2>&1
title GMHelper 备份工具

echo.
echo ========================================
echo   GMHelper 备份工具
echo ========================================
echo.
echo   [1] 全量备份（所有用户）
echo   [2] 增量对比备份（仅记录有变化的用户）
echo   [3] 查看备份历史
echo   [Q] 退出
echo.
set /p choice=请选择操作 [1]:

if /i "%choice%"=="Q" goto :eof
if /i "%choice%"=="q" goto :eof

set BACKUP_SCRIPT=%~dp0backup.js
set RESTORE_SCRIPT=%~dp0restore.js
set LIST_SCRIPT=%~dp0list-backups.js

if "%choice%"=="1" (
    echo.
    echo [全量备份] 正在执行...
    echo.
    node "%BACKUP_SCRIPT%"
    echo.
    pause
    goto :eof
)

if "%choice%"=="2" (
    echo.
    echo [增量对比备份] 正在执行...
    echo.
    node "%BACKUP_SCRIPT%" --diff
    echo.
    pause
    goto :eof
)

if "%choice%"=="3" (
    echo.
    if exist "%LIST_SCRIPT%" (
        node "%LIST_SCRIPT%"
    ) else (
        echo 查看备份目录:
        dir /b /o-d "%~dp0backups" 2>nul || echo   暂无备份记录
    )
    echo.
    pause
    goto :eof
)

echo.
echo 无效选择，请重新运行
pause

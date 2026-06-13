@echo off
rem ============================================================
rem  Lancement de l'application "Lignes d'influence"
rem  - Demarre le backend FastAPI (uvicorn)
rem  - Ouvre le frontend dans le navigateur
rem ============================================================
setlocal
cd /d "%~dp0"

rem --- Choix de l'interpreteur Python (venv si present) ---
set "PY=python"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"

echo Interpreteur : %PY%

rem --- Verifier / installer les dependances ---
"%PY%" -c "import fastapi, uvicorn, numpy" 1>nul 2>nul
if errorlevel 1 (
    echo.
    echo Installation des dependances ^(requirements.txt^)...
    "%PY%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERREUR] L'installation des dependances a echoue.
        pause
        exit /b 1
    )
)

rem --- Demarrer le backend dans une nouvelle fenetre ---
echo.
echo Demarrage du backend sur http://127.0.0.1:8000 ...
start "Backend - Lignes d'influence" cmd /k ""%PY%" -m uvicorn backend.main:app --reload"

rem --- Laisser le serveur demarrer avant d'ouvrir le frontend ---
timeout /t 3 /nobreak >nul

rem --- Ouvrir le frontend dans le navigateur par defaut ---
echo Ouverture du frontend...
start "" "%~dp0frontend\index.html"

echo.
echo ============================================================
echo  Application lancee.
echo  - API   : http://127.0.0.1:8000
echo  - Docs  : http://127.0.0.1:8000/docs
echo  - Front : frontend\index.html (ouvert dans le navigateur)
echo.
echo  Pour arreter : fermez la fenetre "Backend - Lignes d'influence".
echo ============================================================
echo.
pause
endlocal

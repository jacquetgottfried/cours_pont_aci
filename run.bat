@echo off
rem ============================================================
rem  Lancement de l'application "Ponts a poutres"
rem  - Demarre le backend FastAPI (uvicorn) sur :8000
rem  - Demarre le frontend React/Vite (web/) sur :5173
rem ============================================================
setlocal
cd /d "%~dp0"

rem --- Choix de l'interpreteur Python (venv si present) ---
set "PY=python"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"

echo Interpreteur : %PY%

rem --- Verifier / installer les dependances Python ---
"%PY%" -c "import fastapi, uvicorn, numpy" 1>nul 2>nul
if errorlevel 1 (
    echo.
    echo Installation des dependances Python ^(requirements.txt^)...
    "%PY%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERREUR] L'installation des dependances Python a echoue.
        pause
        exit /b 1
    )
)

rem --- Installer les dependances du frontend si besoin ---
if not exist "web\node_modules" (
    echo.
    echo Installation des dependances frontend ^(npm install^)...
    pushd web
    call npm install
    popd
)

rem --- Demarrer le backend dans une nouvelle fenetre ---
echo.
echo Demarrage du backend sur http://127.0.0.1:8000 ...
start "Backend - Ponts a poutres" cmd /k ""%PY%" -m uvicorn backend.main:app --reload"

rem --- Demarrer le frontend React (Vite) dans une nouvelle fenetre ---
echo Demarrage du frontend sur http://127.0.0.1:5173 ...
start "Frontend - Ponts a poutres" cmd /k "cd web && npm run dev"

echo.
echo ============================================================
echo  Application lancee.
echo  - API   : http://127.0.0.1:8000  (docs : /docs)
echo  - Front : http://127.0.0.1:5173  (ouvrez ce lien)
echo.
echo  Pour arreter : fermez les deux fenetres ouvertes.
echo ============================================================
echo.
pause
endlocal

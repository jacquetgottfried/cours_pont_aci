@echo off
rem ============================================================
rem  INSTALLERMOI.bat
rem  Installation complete de l'application "Ponts a poutres"
rem  (lignes d'influence, HL-93, dalle de tablier)
rem
rem  AUCUNE connaissance technique requise : double-cliquez.
rem  Le script :
rem    1. verifie Python (>= 3.10)
rem    2. verifie Node.js / npm
rem    3. cree l'environnement Python isole .venv
rem    4. installe les dependances Python (requirements.txt)
rem    5. installe les dependances du site web (npm install)
rem    6. verifie que le moteur de calcul repond
rem
rem  Necessite une connexion internet. A la fin : lancez run.bat
rem ============================================================

setlocal
cd /d "%~dp0"
title Installation - Ponts a poutres

echo.
echo ============================================================
echo   INSTALLATION - Ponts a poutres (lignes d'influence)
echo ============================================================
echo   Dossier : %CD%
echo.
echo   Cette operation peut prendre quelques minutes.
echo   Ne fermez pas cette fenetre avant le message final.
echo ============================================================
echo.

rem ------------------------------------------------------------
rem  ETAPE 1/6 - Trouver un Python >= 3.10
rem ------------------------------------------------------------
echo [1/6] Recherche de Python...

set "PYBASE="
call :find_python
if not defined PYBASE goto :no_python

echo       Python trouve : %PYBASE%
for /f "delims=" %%V in ('%PYBASE% -c "import sys;print(sys.version.split()[0])"') do echo       Version : %%V
echo.

rem ------------------------------------------------------------
rem  ETAPE 2/6 - Verifier Node.js / npm (pour l'interface web)
rem ------------------------------------------------------------
echo [2/6] Recherche de Node.js (npm)...

where npm >nul 2>nul
if errorlevel 1 goto :install_node
where node >nul 2>nul
if errorlevel 1 goto :install_node

for /f "delims=" %%V in ('node --version 2^>nul') do echo       Node.js trouve : %%V
echo.
goto :step3

:install_node
echo.
echo       Node.js n'est PAS installe. Il sert a afficher l'interface web.
echo.
where winget >nul 2>nul
if errorlevel 1 goto :node_manual

choice /c ON /n /m "      Installer Node.js LTS automatiquement ? (O = oui / N = non) "
if errorlevel 2 goto :node_manual

echo.
echo       Installation de Node.js LTS (winget)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :node_manual

echo.
echo ============================================================
echo   Node.js vient d'etre installe.
echo   Windows doit rafraichir ses variables d'environnement :
echo.
echo   1. FERMEZ cette fenetre
echo   2. RELANCEZ INSTALLERMOI.bat (double-clic)
echo.
echo   L'installation reprendra la ou elle s'est arretee.
echo ============================================================
echo.
pause
exit /b 0

:node_manual
echo.
echo ============================================================
echo   [A FAIRE] Installez Node.js manuellement :
echo.
echo     https://nodejs.org/  (bouton "LTS", installeur Windows)
echo.
echo   Acceptez les options par defaut, puis RELANCEZ
echo   INSTALLERMOI.bat.
echo.
echo   Note : la partie Python peut deja etre installee ci-dessous,
echo   mais l'interface web ne demarrera pas sans Node.js.
echo ============================================================
echo.
pause
exit /b 1

:step3
rem ------------------------------------------------------------
rem  ETAPE 3/6 - Environnement Python isole (.venv)
rem ------------------------------------------------------------
echo [3/6] Environnement Python isole (.venv)...

if exist ".venv\Scripts\python.exe" (
    echo       Deja present, reutilise.
) else (
    echo       Creation...
    %PYBASE% -m venv .venv
    if errorlevel 1 goto :fail_venv
    echo       Cree.
)
set "PY=.venv\Scripts\python.exe"
echo.

rem ------------------------------------------------------------
rem  ETAPE 4/6 - Dependances Python
rem ------------------------------------------------------------
echo [4/6] Installation des dependances Python (numpy, fastapi, ...)...
echo.
"%PY%" -m pip install --upgrade pip
"%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto :fail_pip
echo.
echo       Dependances Python installees.
echo.

rem ------------------------------------------------------------
rem  ETAPE 5/6 - Dependances de l'interface web
rem ------------------------------------------------------------
echo [5/6] Installation des dependances de l'interface web (npm)...
echo.
set "NPMFAIL="
pushd web
call npm install
if errorlevel 1 set "NPMFAIL=1"
popd
if defined NPMFAIL goto :fail_npm
echo.
echo       Interface web prete.
echo.

rem ------------------------------------------------------------
rem  ETAPE 6/6 - Verification
rem ------------------------------------------------------------
echo [6/6] Verification du moteur de calcul...
"%PY%" -c "from engine import compute_influence_line as f; r = f(spans=[15,10,15], quantity='R', target_x=0.0, dx=1.0); print('      Moteur OK :', len(r['x']), 'points calcules')"
if errorlevel 1 goto :fail_check

if exist "tests" (
    echo       Execution de la suite de tests ^(quelques secondes^)...
    "%PY%" -m pytest tests -q
    if errorlevel 1 (
        echo.
        echo       [AVERTISSEMENT] Des tests ont echoue.
        echo       L'application reste utilisable ; signalez-le a votre enseignant.
    )
)

echo.
echo ============================================================
echo   INSTALLATION TERMINEE
echo.
echo   Pour lancer l'application :
echo     double-cliquez sur  run.bat
echo.
echo   Puis ouvrez dans votre navigateur :
echo     http://127.0.0.1:5173      (interface)
echo     http://127.0.0.1:8000/docs (documentation de l'API)
echo.
echo   Cette installation ne se refait qu'une seule fois.
echo ============================================================
echo.
pause
exit /b 0


rem ============================================================
rem  Sous-routines
rem ============================================================

:find_python
rem Cherche un interpreteur Python >= 3.10 parmi les commandes usuelles.
rem Le "python" factice du Microsoft Store est ecarte car il echoue au test.
for %%C in ("py -3" "python" "python3") do (
    %%~C -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PYBASE=%%~C"
        goto :eof
    )
)
goto :eof


rem ============================================================
rem  Sorties en erreur
rem ============================================================

:no_python
echo.
echo ============================================================
echo   [ERREUR] Aucun Python 3.10 ou plus recent n'a ete trouve.
echo.
where winget >nul 2>nul
if errorlevel 1 goto :no_python_manual

choice /c ON /n /m "      Installer Python automatiquement ? (O = oui / N = non) "
if errorlevel 2 goto :no_python_manual

echo.
echo       Installation de Python (winget)...
winget install -e --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :no_python_manual
echo.
echo   Python vient d'etre installe.
echo   FERMEZ cette fenetre puis RELANCEZ INSTALLERMOI.bat.
echo ============================================================
echo.
pause
exit /b 0

:no_python_manual
echo   Installez Python manuellement :
echo.
echo     https://www.python.org/downloads/windows/
echo.
echo   IMPORTANT : dans l'installeur, cochez la case
echo     "Add python.exe to PATH"
echo   puis relancez INSTALLERMOI.bat.
echo ============================================================
echo.
pause
exit /b 1

:fail_venv
echo.
echo ============================================================
echo   [ERREUR] Impossible de creer l'environnement .venv.
echo   Verifiez que vous avez les droits d'ecriture dans :
echo     %CD%
echo   Si le dossier est synchronise (OneDrive), mettez la
echo   synchronisation en pause puis relancez.
echo ============================================================
echo.
pause
exit /b 1

:fail_pip
echo.
echo ============================================================
echo   [ERREUR] L'installation des dependances Python a echoue.
echo   Causes frequentes : pas de connexion internet, ou un
echo   pare-feu / proxy qui bloque pip.
echo   Relancez INSTALLERMOI.bat une fois le reseau retabli.
echo ============================================================
echo.
pause
exit /b 1

:fail_npm
echo.
echo ============================================================
echo   [ERREUR] "npm install" a echoue (dossier web).
echo   Causes frequentes : pas de connexion internet, ou proxy.
echo   Vous pouvez reessayer ainsi :
echo     cd web
echo     npm install
echo ============================================================
echo.
pause
exit /b 1

:fail_check
echo.
echo ============================================================
echo   [ERREUR] Le moteur de calcul ne repond pas.
echo   Supprimez le dossier .venv puis relancez INSTALLERMOI.bat.
echo ============================================================
echo.
pause
exit /b 1

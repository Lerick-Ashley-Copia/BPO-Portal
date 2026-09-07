@echo off
start "BPO Portal - Backend (:4310)" cmd /k "cd /d "%~dp0backend" && npm run local"
start "BPO Portal - Frontend (:4300)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

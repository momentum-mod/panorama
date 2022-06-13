@echo off
:: Get latest types file and plop it in scripts

powershell Invoke-WebRequest https://github.com/panorama-languages-support/panorama-jsdoc-gen/releases/latest/download/types_momentum.zip -OutFile types.zip

tar -xf types.zip -C ./
DEL types.zip

MOVE .\__types_momentum.js ..\scripts\

PAUSE

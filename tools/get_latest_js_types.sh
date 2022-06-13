#!/bin/bash
# Get latest types file and cram it into scripts

wget "https://github.com/panorama-languages-support/panorama-jsdoc-gen/releases/latest/download/types_momentum.zip"

tar -xvf types_momentum.zip

rm -v types_momentum.zip

mv -v __types_momentum.js ../scripts/

exit

#!/bin/bash
# Script to fetch constants from the website repo. 

set -e
WEBSITE_REPO="https://github.com/momentum-mod/website"

if [[ $PWD == */panorama/tools ]]; then
  cd ../
fi

if [ ! -f package.json ] && [[ $PWD != */panorama ]]; then
  echo "Doesn't look like we're in the panorama directory, exiting"
  exit 1
fi

rm -rf ./constants-tmp
rm -rf ./website-tmp

if [ "$1" == "-b" ] || [ "$1" == "" ]; then
  echo "Fetching constants from website repo..."
  if [ "$1" == "-b" ]; then
   git clone -b "$2" $WEBSITE_REPO ./website-tmp 
  else
    git clone $WEBSITE_REPO ./website-tmp
  fi 
  
  mkdir -p ./scripts/common/web
  mv ./website-tmp/libs/constants/src/* ./scripts/common/web
  mv ./website-tmp/libs/enum/src/enum.ts ./scripts/util/enum.ts
  rm -rf ./website-tmp
elif [ "$1" == "-l" ]; then
  echo "Copying constants from local path"
  mkdir -p ./scripts/common/web
  cp -r "$2"/libs/constants/src/* ./scripts/common/web
  cp -r "$2"/libs/enum/src/enum.ts ./scripts/util/enum.ts
elif [ "$1" == "-h" ]; then
  echo "usage: fetch-web.sh [-b branch] [-l local-path] [-h]"
  exit 0
fi

echo "Removing unwanted files"
cd ./scripts/common/web || exit 1
rm index.ts types/models/prisma-correspondence.ts
rm -rf types/queries/*
cd ../../..

echo "Running prettier"
npx prettier --write ./scripts/common/web/**/*.ts ./scripts/util/enum.ts

echo "Creating Git commit"
git reset
git add ./scripts/common/web/* ./scripts/util/enum.ts
git commit -m 'chore: update website dependencies' --no-verify

echo "Done!"


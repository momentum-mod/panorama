#!/bin/bash
set -e

# Script to fetch constants from the website repo. Panorama/V8 doesn't
# understand import/export, so we strip them out and combine into one big
# namespace.

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
  
  mv ./website-tmp/libs/constants/src/ ./constants-tmp
  rm -rf ./website-tmp
elif [ "$1" == "-l" ]; then
  echo "Copying constants from local path"
  cp -r "$2"/libs/constants/src ./constants-tmp
elif [ "$1" == "-h" ]; then
  echo "usage: fetch-constants.sh [-b branch] [-l local-path] [-h]"
  exit 0
fi

cd ./constants-tmp || exit 1
rm index.ts types/models/prisma-correspondence.ts

printf "/**
 * Collection of constants from the website repo.
 * Use npm run fetch-constants to update.
 * Don't modify this file directly; it's generated from the website repo and
 * will be overwritten by the fetch script.
 */
 namespace Constants {
 
 // Stub to make the compiler happy
 type File = never;
 
" > website-constants.ts

for file in **/*.ts **/*/*.ts; do
  sed -z 's/import[^;]*;\n*//g' "$file" |
  sed -zE 's/\/\/ *TODO[^\n]*\n//g' | 
  grep -vE '// ?prettier-ignore' >> website-constants.ts
  printf "\n" >> website-constants.ts
done

echo "}" >> website-constants.ts

echo "Generated website-constants.ts"
echo "Running prettier"

npx prettier --write website-constants.ts
cd ../

echo "Moving website-constants.ts to scripts/common/"
mv ./constants-tmp/website-constants.ts ./scripts/common/website-constants.ts

echo "Cleaning up loose files"
rm -rf ./constants-tmp

echo "Creating Git commit"
git add ./scripts/common/website-constants.ts
git commit -m 'chore: update website constants' --no-verify

echo "Done!"


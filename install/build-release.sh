#!/bin/bash

if [ "$1" != "inc" ]; then
  echo -e "\n\033[48;5;21;38;5;255m Q S   -   R e l e a s e \033[0m\n"
fi

# script directory
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# package.json not found
if ! test -e "${dir}/../package.json"; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"package.json\" not found"
  exit 1
fi

# Git not installed
if ! command -v git >/dev/null 2>&1; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"git\" not installed"
  exit 1
fi

# Is there a Git repository?
cd "$dir"
git status &> /dev/null
if (( $? > 0 )); then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m no repository found"
  exit 1
fi

# not on branch 'main'
if [ "$(git branch --show-current)" != "main" ]; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m not on branch 'main'"
  exit 1
fi

# working tree not clean
if [ "$(git diff --stat)" != "" ]; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m working tree not clean"
  exit 1
fi

# remove lines
#   $1 = number of lines to remove
rmLines() {
  local i
  for (( i=0; i<$1; i++ )); do
    tput cuu1
    tput el
  done
}

# detect current app version
appVersion() {
  packageJson="${dir}/../package.json"
  echo $(grep '"version":' "$packageJson" | sed -r 's/.+: "(.+?)",/\1/')
}

# update copyright year
updateCopyright() {
  local about="${dir}/../html/about.html"
  local year="2022"
  if [ "$(date +%Y)" != "$year" ]; then
    year+="–$(date +%Y)"
  fi
  local yearAbout=$(grep "id=\"copyright\"" "$about" | sed -r 's/.+"copyright">(.+?)<.+/\1/')
  if [ "$yearAbout" != "$year" ]; then
    echo -e "  \033[1;32m*\033[0m Update copyright year"
    sed -i "s/copyright\">.*<\/span>/copyright\">${year}<\/span>/" "$about"
  fi
}

# make release notes
#   $1 = version number
makeReleaseNotes() {
  local output="# Release Notes v$1\n"

  # glean commits
  declare -A clCommits
  j=0
  while read z; do
    clCommits[$j]="$z"
    (( j++ ))
  done < <(git log -E --grep="^\[\[(removal|feature|change|update|fix)\]\] " --format="%s" $(git describe --abbrev=0)..HEAD)

  # sort commits
  declare -A clH
  clH[removal]="Entfernte Funktionen"
  clH[feature]="Neue Funktionen"
  clH[change]="Verbesserungen"
  clH[update]="Updates"
  clH[fix]="Behobene Fehler"
  local commitTypes=(removal reature change update fix)
  for type in ${!commitTypes[@]}; do
    local newType=1
    for commit in ${!clCommits[@]}; do
      local message=${clCommits[$commit]}
      local currentType=${commitTypes[$type]}
      if echo "$message" | egrep -q "^${currentType}"; then
        if (( newType > 0 )); then
          newType=0;
          output+="\n## ${clH[${commitTypes[$type]}]}\n\n"
        fi
        message=$(echo "$message" | sed -r 's/^.+?:\s//')
        output+="* $message\n"
      fi
    done
  done

  # save release notes
  echo -en "$output" > "../releases/v${1}.md"
}

# prepare release
prepare() {
  echo -e "  \033[1;32m*\033[0m Prepare release\n"
  cd "${dir}/../"

  # set version
  read -p "  Next job \"Set version\" (press Enter) . . ."
  echo -e "\n  \033[1;32m*\033[0m Set version\n"
  while : ; do
    read -ep "Version: " -i "$(appVersion)" version
    if ! echo "$version" | egrep -q "^[0-9]+\.[0-9]+\.[0-9]+$"; then
      echo -e "\n\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m Wrong format"
      sleep 1
      rmLines 4
      continue
    else
      rmLines 1
      echo -e "Version: \033[1;33m${version}\033[0m"
      # inject version into package.json
      local line="\t\"version\": \"${version}\","
      sed -i "s/\t\"version\".*/${line}/" "package.json"
      echo ""
      break
    fi
  done

  # update copyright year
  read -p "  Next job \"Update copyright year\" (press Enter) . . ."
  echo ""
  updateCopyright
  echo ""

  # make release commit
  read -p "  Next Job \"Make release commit\" (press Enter) . . ."
  echo -e "\n  \033[1;32m*\033[0m Make release commit\n"
  git status
  echo ""
  git commit -am "release prepared"
  echo ""
  git status
  echo ""

  # make release notes
  read -p "  Next Job \"Make release notes\" (press Enter) . . ."
  echo -e "\n  \033[1;32m*\033[0m Make release notes"
  makeReleaseNotes $version
  echo ""

  # tag release
  read -p "  Next Job \"Tag release\" (press Enter) . . ."
  echo -e "\n  \033[1;32m*\033[0m Tag release\n"
  declare -A types
  types[1]="Feature release v${version}"
  types[2]="Release v${version}, fixes"
  types[3]="Release v${version}, Electron update"
  types[4]="Release v${version}, Electron update und fixes"
  local j
  for j in ${!types[@]}; do
    echo " [${j}] ${types[$j]}"
  done
  while : ; do
    read -ep "  " releaseType
    if echo "$releaseType" | egrep -q "^[1-4]$"; then
      break
    else
      rmLines 1
    fi
  done
  echo ""
  git tag -a v${version} -m "${types[$releaseType]}"
  echo ""
  git log HEAD^..HEAD
  echo ""

  # garbage collection
  read -p "  Next job \"Garbage collection\" (press Enter) . . ."
  echo -e "\n  \033[1;32m*\033[0m Garbage collection"
  echo -e "\nRepository size: $(du -sh .git | cut -d $'\t' -f 1)\n"
  git gc
  echo -e "\nRepository size: $(du -sh .git | cut -d $'\t' -f 1)\n"

  # Done!
  echo -e "Release \033[1;32mv${version}\033[0m prepared!"

  cd "$dir"
}

# start
if [ "$1" = "inc" ]; then
  prepare
else
  while : ; do
    read -ep "Prepare release (y/n): " prep
    if [ "$prep" = "y" ]; then
      echo -e "\n"
      prepare
      exit 0
    elif [ "$prep" = "n" ]; then
      exit 0
    else
      rmLines 1
    fi
  done
fi

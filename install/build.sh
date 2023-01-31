#!/bin/bash

# Presets
presets=(
  "GitHub"
  "Test (Linux)"
  "Test (all)"
)
preset1=(
  "type=installer|os=linux|pkg=deb|clean=y"
  "type=installer|os=win|pkg=nsis|clean=y"
  "type=packager|os=linux|arch=gz|clean=y"
  "type=packager|os=mac|arch=gz|clean=y"
  "type=packager|os=win|arch=zip|clean=y"
  "type=tarball|clean=n"
)
preset2=(
  "type=packager|os=linux|arch=-|clean=y"
)
preset3=(
  "type=packager|os=linux|arch=-|clean=y"
  "type=packager|os=win|arch=-|clean=y"
  "type=packager|os=mac|arch=gz|clean=y"
)

# maintainer mail
declare -A addresses
addresses["Nico Dorn"]="ndorn gwdg de"

echo -e "\n\033[48;5;21;38;5;255m Q S   -   B u i l d \033[0m\n"

# script directory
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# package.json not found
if ! test -e "${dir}/../package.json"; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"package.json\" not found"
  exit 1
fi

# Node.js not installed
if ! command -v node >/dev/null 2>&1; then
  echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"Node.js\" not installed"
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

# system name for Node.js
sysName() {
  declare -A sys
  sys[linux]="linux"
  sys[mac]="darwin"
  sys[win]="win32"
  echo ${sys[$os]}
}

# test whether the repository is accesible or not
gitOkay() {
  local okay=0
  if command -v git >/dev/null 2>&1; then # Git installed?
    git status &> /dev/null # Repository exists?
    if (( $? == 0 )); then
      git describe --abbrev=0 &> /dev/null # Tags available?
      if (( $? == 0 )); then
        okay=1
      fi
    fi
  fi
  echo $okay
}

# detect mail address of the maintainer
getMail() {
  local mail=""

  # search maintainer in repository
  local okay=$(gitOkay)
  if (( okay > 0 )); then
    local tagger=$(git show $(git describe --abbrev=0) | head -n 2 | tail -n 1)
    local name=$(echo "$tagger" | sed -r 's/.+?:\s+(.+?)\s<.+/\1/')
    if [ ${addresses[$name]+isset} ]; then
      mail=${addresses[$name]/ /@}
      mail=${mail/ /.}
    else
      mail="no-reply@address.com"
    fi
  fi

  # no address found
  if test -z "$mail"; then
    mail="no-replay@address.com"
  fi

  # return address
  echo "$mail"
}

# configure script
configuration() {
  # script type
  while : ; do
    read -ep "Type (installer/packager/tarball): " type
    if ! echo "$type" | egrep -q "^(installer|packager|tarball)$"; then
      rmLines 1
      continue
    fi
    break
  done

  # OS
  os=""
  if [ "$type" != "tarball" ]; then
    while : ; do
      read -ep "OS (linux/mac/win): " os
      if ! echo "$os" | egrep -q "^(linux|win|mac)$"; then
        rmLines 1
        continue
      fi
      break
    done
  fi

  # installer
  pkg=""
  if [ "$type" = "installer" ]; then
    # installer format
    if [ "$os" = "linux" ]; then
      while : ; do
        read -ep "Format (appImage/deb/rpm): " pkg
        if ! echo "$pkg" | egrep -q "^(appImage|deb|rpm)$"; then
          rmLines 1
          continue
        fi
        break
      done
    elif [ "$os" = "mac" ]; then
      while : ; do
        read -ep "Format (dmg): " -i "dmg" pkg
        if ! echo "$pkg" | egrep -q "^(dmg)$"; then
          rmLines 1
          continue
        fi
        break
      done
    elif [ "$os" = "win" ]; then
      while : ; do
        read -ep "Format (nsis): " -i "nsis" pkg
        if [ "$pkg" != "nsis" ]; then
          rmLines 1
          continue
        fi
        break
      done
    fi
  fi

  # packager
  arch=""
  if [ "$type" = "packager" ]; then
    # compression
    while : ; do
      read -ep "Archive (-/gz/zip): " arch
      if ! echo "$arch" | egrep -q "^(-|gz|zip)$"; then
        rmLines 1
        continue
      fi
      break
    done
    # build folder
    build="../build"
    read -ep "Build folder: " -i "$build" build
  fi

  # clean-up
  while : ; do
    read -ep "Clean-up (y/n): " clean
    if ! echo "$clean" | egrep -q "^(y|n)$"; then
      rmLines 1
      continue
    fi
    break
  done

  # result
  job="type=${type}"
  if ! test -z "$os"; then
    job+="|os=${os}"
  fi
  if ! test -z "$pkg"; then
    job+="|pkg=${pkg}"
  fi
  if ! test -z "$arch"; then
    job+="|arch=${arch}"
  fi
  if ! test -z "$build"; then
    job+="|build=${build}"
  fi
  job+="|clean=${clean}"
}

# make changelog for DEB or RPM packages
makeChangelog() {
  # Git not installed
  if ! command -v git >/dev/null 2>&1; then
    echo "" # make empty changelog
    return
  fi

  # no repository found
  git status &> /dev/null
  if (( $? > 0 )); then
    echo "" # make empty changelog
    return
  fi

  # collect all tags
  tags=($(git tag --sort=-creatordate))

  # variable for the changelog
  output=""

  # prepare a release block for every tag
  for (( i=0; i<${#tags[@]}; i++ )); do
    # version, name, mail, date, release type
    clVersion=${tags[$i]}
    clName=""
    clMail=""
    clDate=""
    clRelease="" # fallback if no list with important commits is present
    while read z; do
      if test -z "$z"; then
        continue
      elif echo "$z" | egrep -q "^Tagger:"; then
        clName=$(echo "$z" | sed -r 's/.+?:\s+(.+?)\s<.+/\1/')
        if [ ${addresses[$clName]+isset} ]; then
          clMail=${addresses[$clName]/ /@}
          clMail=${clMail/ /.}
        else
          clMail="no-reply@address.com"
        fi
      elif echo "$z" | egrep -q "^Date:"; then
        date=($(echo "$z" | sed -r 's/.+?:\s+(.+)/\1/'))
        if [ "$1" = "deb" ]; then
          clDate="${date[0]}, ${date[2]} ${date[1]} ${date[4]} ${date[3]} ${date[5]}"
        elif [ "$1" = "rpm" ]; then
          clDate="${date[0]} ${date[1]} ${date[2]} ${date[4]}"
        fi
      else
        clRelease=$(echo "$z" | sed -r 's/\sv[0-9]+\.[0-9]+\.[0-9]+//')
      fi
    done < <(git show "${tags[$i]}" | head -n 5 | tail -n 4)

    # collect commits
    clCommits=() # this array needs to be reset after every run
    declare -A clCommits
    next=$[i + 1]
    j=0
    while read z; do
      IFS=" " read -r sha1 message <<< "$z"
      clCommits[$j]="$message"
      (( j++ ))
    done < <(git log -E --grep="^\[\[(removal|feature|change|update|fix)\]\] " --oneline ${tags[$next]}..${tags[$i]})

    # build changelog block
    commitTypes=(removal feature change update fix)
    if [ "$1" = "deb" ]; then
      output+="QS (${clVersion}) whatever; urgency=medium\n"
      output+="\n"
      if (( ${#clCommits[@]} > 0 )); then
        for type in ${!commitTypes[@]}; do
          for commit in ${!clCommits[@]}; do
            message=${clCommits[$commit]}
            if echo "$message" | egrep -q "^\[\[${commitTypes[$type]}\]\]"; then
              output+="  * $message\n"
            fi
          done
        done
      else
        output+="  * ${clRelease}\n"
      fi
      output+="\n"
      output+=" -- ${clName} <${clMail}> ${clDate}\n"
      if (( i < ${#tags[@]} - 1 )); then
        output+="\n"
      fi
    elif [ "$1" = "rpm" ]; then
      output+="* ${clDate} ${clName} <${clMail}> - ${clVersion}\n"
      if (( ${#clCommits[@]} > 0 )); then
        for type in ${!commitTypes[@]}; do
          for commit in ${!clCommits[@]}; do
            message=${clCommits[$commit]}
            if echo "$message" | egrep -q "^${commitTypes[$type]}"; then
              output+="- $message\n"
            fi
          done
        done
      else
        output+="- ${clRelease}\n"
      fi
      if (( i < ${#tags[@]} - 1 )); then
        output+="\n"
      fi
    fi
  done
  
  echo "$output"
}

makeArchive() {
  echo -e "  \033[1;32m*\033[0m Make archive"
  cd "$1"

  # file name
  version=$(appVersion)
  system=$(sysName)
  ext=$arch
  if [ "$arch" = "gz" ]; then
    ext="tar.gz";
  fi
  file="QS_${version}_${system}_x64.${ext}"

  # remove old archive
  if test -e "$file"; then
    rm $file
  fi

  # make new archive
  if [ "$arch" = "gz" ]; then
    tar -c -f $file -z QS-${system}-x64
  elif [ "$arch" = "zip" ]; then
    zip -qr $file QS-${system}-x64
  fi

  cd "$dir"
}

# execute job
#   $1 = string with variables, separator "|"
execJob() {
  echo -e "  \033[1;32m*\033[0m Start job: $1"
  echo -e "    App version: \033[38;5;63m$(appVersion)\033[0m"

  # reset and fill varialbes
  type=""
  os=""
  pkg=""
  arch=""
  clean=""
  build=""
  vars=$(echo "$1" | tr "|" "\n")
  for var in $vars; do
    eval "$var"
  done
  if echo "$build" | egrep -q "^\.\."; then
    build="${dir}/../${build}"
  elif test -z "$build" || ! test -e "$build"; then
    build="${dir}/../../build"
  fi

  # checks
  if [ "$arch" = "zip" ] && ! command -v zip >/dev/null 2>&1; then
    echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"zip\" not installed"
    return
  fi

  # make build folder
  if ! test -d "$build"; then
    echo -e "  \033[1;32m*\033[0m make $build"
    mkdir "$build"
    if (( $? > 0 )); then
      echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m failed to create \"$build\""
      return
    fi
  fi

  # make changelog for DEB or RPM packages
  if echo "$pkg" | egrep -q "^(deb|rpm)$" ; then
    echo -e "  \033[1;32m*\033[0m Make changelog"
    cd "$dir"
    echo -en "$(makeChangelog $pkg)" > "${build}/changelog"
  fi

  # installer
  if [ "$type" = "installer" ]; then
    echo -e "  \033[1;32m*\033[0m Execute installer"
    cd "${dir}/../"
    node ./install/installer-${os}.js $pkg $(getMail)
    if (( $? > 0 )); then
      echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m Installer failed"
      cd "$dir"
      return
    fi
  fi

  # packager
  if [ "$type" = "packager" ]; then
    echo -e "  \033[1;32m*\033[0m Execute packager"
    cd "${dir}/../"
    node ./install/packager.js "$(sysName)" "${build}"
    if (( $? > 0 )); then
      echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m Package failed"
      cd "$dir"
      return
    fi
    if ! echo "$arch" | egrep -q "^(gz|zip)$"; then
      system=$(sysName)
      mv "${build}/QS-${system}-x64" "${build}/QS-${system}-x64-packed"
    fi
  fi

  # tarball
  if [ "$type" = "tarball" ]; then
    echo -e "  \033[1;32m*\033[0m Make tarball"
    cd "${dir}/../"
    if (( $(gitOkay) == 0 )); then
      echo -e "\n\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m Archiving failed"
      return
    fi
    version=$(appVersion)
    git archive --format=tar --prefix=QS_${version}/ HEAD | gzip > "${build}/QS_${version}.tar.gz"
  fi

  cd "$dir"

  # make archive
  if echo "$arch" | egrep -q "^(gz|zip)$"; then
    makeArchive "$build"
  fi

  # clean-up
  if [ "$clean" = "y" ]; then
    echo -e "  \033[1;32m*\033[0m Clean up $build"
    # clean-up
    while read f; do
      if ! echo "$f" | egrep -q "(\.blockmap|changelog|-unpacked|\.yaml|\.yml|QS-(darwin|linux|win32)-x64)\$"; then
        continue
      fi
      rm -r "$f"
    done < <(find "$build" -mindepth 1 -maxdepth 1)
  fi
}

# create file with SHA sums
shaSums() {
  local build="${dir}/../../build/"

  # check whether "build" exists or not
  if ! test -d "$build"; then
    echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"../../build\" not found"
    return
  fi

  # create file with SHA sums
  echo -e "  \033[1;32m*\033[0m Create file with sha256 sums"
  cd "$build"
  sha256sum * > sha256sums.txt

  cd "$dir"
}

# print list of presets
presetsPrint() {
  echo -e "\n"
  for (( i=0; i<${#presets[@]}; i++ )); do
    echo " [$[i + 1]] ${presets[$i]}"
  done
  echo " [c] cancel"
  while : ; do
    read -ep "  " preset
    if [ "$preset" = "c" ]; then
      return
    elif echo "$preset" | egrep -q "^[1-9]{1}$" && (( preset  <= ${#presets[@]} )); then
      presetsExec $preset
      break
    else
      rmLines 1
    fi
  done
}

# execute preset
presetsExec() {
  # run jobs
  declare -n array="preset$1"
  presetNo=$[$1 - 1]
  for (( i=0; i<${#array[@]}; i++ )); do
    echo -en "\n  \033[1;33m*\033[0m Preset \"${presets[$presetNo]}\":"
    echo -e " \033[1;33mJob $[i + 1]/${#array[@]}\033[0m\n"
    execJob "${array[$i]}"
  done

  # all jobs done
  echo -e "\n  \033[1;32m*\033[0m Preset \"${presets[$presetNo]}\": \033[1;32mDone!\033[0m"
}

# start
while : ; do
  # select action
  read -ep "Execute (job/release/preset/sha/config/modules/exit): " action
  if ! echo "$action" | egrep -q "^(job|release|preset|sha|config|modules|exit)$"; then
    rmLines 1
    continue
  fi

  # create and execute new job
  if [ "$action" = "job" ]; then
    echo -e "\n"
    configuration
    echo -e "\n"
    execJob "$job"
    echo -e "\n"
  # prepare release
  elif [ "$action" = "release" ]; then
    echo -e "\n"
    bash "${dir}/build-release.sh" inc
    echo -e "\n"
  # select preset
  elif [ "$action" = "preset" ]; then
    presetsPrint
    echo -e "\n"
  # create file with SHA sums
  elif [ "$action" = "sha" ]; then
    shaSums
    echo -e "\n"
  # show configuration
  elif [ "$action" = "config" ]; then
    echo -e "\n"
    configuration
    echo -e "\n\nJob configuration:\n  \033[1;32m*\033[0m $job\n\n"
  # update modules
  elif [ "$action" = "modules" ]; then
    echo -e "\n"
    bash "${dir}/build-modules.sh" inc
    echo -e "\n"
  # exit script
  elif [ "$action" = "exit" ]; then
    exit 0
  fi
done

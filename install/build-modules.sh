#!/bin/bash

modules=(
	"electron"
	"electron-builder"
	"electron-packager"
)

if [ "$1" != "inc" ]; then
	echo -e "\n\033[48;5;21;38;5;255m Q S   -   M o d u l e s \033[0m\n"
fi

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

# NPM not installed
if ! command -v npm >/dev/null 2>&1; then
	echo -e "\033[1;31mError!\033[0m\n  \033[1;31m*\033[0m \"NPM\" not installed"
	exit 1
fi

# Is there a Git repository?
cd "$dir"
repository=0
if command -v git >/dev/null 2>&1; then
	git status &> /dev/null
	if (( $? == 0 )); then
		repository=1
	fi
fi

# get module version
#   $1 = path to package.json
getVersion() {
	echo $(grep '"version":' "$1" | sed -r 's/.+?: "(.+?)".*/\1/')
}

# install modules
installModules() {
	echo -e "  \033[1;32m*\033[0m Install or update modules"

	cd "${dir}/../"

	for (( i=0; i<${#modules[@]}; i++ )); do
		local moduleBase=${modules[$i]%%@*}
		echo -e "\n*** ${moduleBase} ***"
		
		# module isn't installed yet => install it
		local local="node_modules/${moduleBase}/package.json"
		if ! test -e "$local"; then
			echo -e "  \033[1;32m*\033[0m Installation\n"
			npm install --save-dev ${modules[$i]}
			continue
		fi

		# module is installed => update
		local versionPkg=$(npm show ${modules[$i]} version)
		local versionInst=$(getVersion "$local")
		if [ "$versionPkg" != "$versionInst" ]; then
			echo -e "installed \033[1;31m$versionInst\033[0m, online \033[1;32m$versionPkg\033[0m"
			echo -e "  \033[1;32m*\033[0m Update"
			npm install --save-dev ${modules[$i]}
		fi
		echo -e "installed \033[1;32m$(getVersion "$local")\033[0m"
	done

	cd "$dir"
}

# starter
if [ "$1" = "inc" ]; then
	installModules
else
	echo ""
	while : ; do
		read -ep "Install or update modules (j) " -i "j" install
		if [ "$install" = "j" ]; then
			echo -e "\n"
			installModules
			exit 0
		else
			exit 0
		fi
	done
fi

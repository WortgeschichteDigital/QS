"use strict";

const git = {
  // URI to remote repository
  remote: "git.zdl.org/zdl/wortgeschichten.git",

  // Git config
  config: {},

  // password for Git repository
  // (only valid for current app session)
  configPass: "",

  // check Git config
  async configCheck () {
    // get config data
    git.config = await shared.ipc.invoke("git-config");
    // check config
    const dirOkay = await git.dirCheck(git.config.dir);
    if (!dirOkay[0] || !git.config.user) {
      // open config form
      git.configFormShow();
      // show message if the directory wasn't found anymore
      if (git.config.dir && !dirOkay[0]) {
        await git.dirError(dirOkay[1]);
      }
      // wait until the configuration is okay
      const gitWin = document.querySelector("#git");
      await new Promise(resolve => {
        const checkConfig = setInterval(() => {
          if (gitWin.classList.contains("hide")) {
            clearInterval(checkConfig);
            resolve(true);
          }
        }, 25);
      });
      // close config form
      await shared.wait(500);
    } else {
      git.fillPrefs();
    }
  },

  // show config overlay
  configFormShow () {
    // show window
    overlay.show("git");

    // fill in
    document.querySelector("#git-dir").value = git.config.dir;
    const user = document.querySelector("#git-user");
    user.value = git.config.user;
    user.select();
  },

  // check inputs in config overlay
  async configFormCheck () {
    const user = document.querySelector("#git-user").value.trim();
    const dir = document.querySelector("#git-dir").value.trim();
    if (!user || !dir) {
      const missing = [];
      if (!user) {
        missing.push("• den Benutzernamen angeben");
      }
      if (!dir) {
        missing.push("• den Pfad zum Repository auswählen");
      }
      await dialog.open({
        type: "alert",
        text: "Sie müssen noch:\n" + missing.join("<br>"),
      });
      if (!user) {
        document.querySelector("#git-user").select();
      } else if (!dir) {
        document.querySelector("#git-dir-open").focus();
      }
      return;
    } else if (/\s/.test(user)) {
      await dialog.open({
        type: "alert",
        text: "Der Benutzername darf keine Leerzeichen enthalten.",
      });
      document.querySelector("#git-user").select();
      return;
    }

    // check directory
    const dirOkay = await git.dirCheck(dir);
    if (!dirOkay[0]) {
      git.config.dir = "";
      git.dirError(dirOkay[1]);
      return;
    }

    // close all preview windows if dir is about to be changed
    if (git.config.dir !== dir) {
      shared.ipc.invoke("pv-close-all");
    }

    // save config data in prefs file
    git.config.user = user;
    git.config.dir = dir;
    shared.ipc.invoke("git-save", git.config);

    // fill in preferences
    git.fillPrefs();

    // close window
    overlay.hide("git");
  },

  // select repository directory
  async dirSelect () {
    const options = {
      title: "Repository auswählen",
      defaultPath: shared.info.documents,
      properties: [ "openDirectory" ],
    };
    const result = await shared.ipc.invoke("file-dialog", true, options);
    if (result.canceld || !result?.filePaths?.length) {
      return;
    }
    document.querySelector("#git-dir").value = result.filePaths[0];
    document.querySelector("#git-okay").focus();
  },

  // check directory with presumed Git repository
  //   dir = string
  async dirCheck (dir) {
    if (!dir) {
      return [ false, "empty" ];
    }
    const structure = {
      ".git": false,
      articles: false,
      ignore: false,
    };
    try {
      const files = await shared.fsp.readdir(dir);
      for (const f of files) {
        structure[f] = true;
      }
    } catch {
      return [ false, "not found" ];
    }
    if (Object.values(structure).some(i => !i)) {
      const missing = [];
      for (const [ k, v ] of Object.entries(structure)) {
        if (!v) {
          missing.push(k);
        }
      }
      return [ false, missing.join(" ") ];
    }
    return [ true, "" ];
  },

  // display appropriate error message
  //   error = string (empty | not found | missing folders, separated by spaces)
  async dirError (error) {
    let text = "";
    if (error === "empty") {
      text = "Sie haben noch keinen Repository-Pfad ausgewählt.";
    } else if (error === "not found") {
      text = "Das ausgewählte Repository existiert nicht mehr.";
    } else {
      const missing = error.split(" ");
      if (missing.includes(".git")) {
        text = "Der ausgewählte Ordner enthält kein Git-Repository.";
      } else {
        const notFound = [];
        for (const i of missing) {
          notFound.push("• " + i);
        }
        text = `Folgende Unterordner wurden nicht im Repository gefunden:\n${notFound.join("<br>")}`;
      }
    }
    await dialog.open({
      type: "alert",
      text,
    });
    document.querySelector("#git-dir-open").focus();
  },

  // return current branch
  async branchCurrent () {
    const result = await git.commandExec("git branch --show-current");
    return result;
  },

  // print current branch
  async branchCurrentPrint () {
    const branchCurrent = await git.branchCurrent();
    document.querySelector("#fun-git-branch").textContent = branchCurrent || "???";
    return branchCurrent;
  },

  // check whether the current branch is clean or not
  //   feedback = false | undefined
  async branchClean (feedback = true) {
    const notClean = await git.commandExec("git diff --stat");
    if (notClean || notClean === false) {
      if (notClean && feedback) {
        await shared.error("Branch nicht sauber, Änderungen an Dateien noch nicht committet");
      }
      return false;
    }
    return true;
  },

  // select branch from a list of available branches
  //   branchList = array
  branchSelect (branchList) {
    // clean up branch list
    branchList.forEach((i, n) => {
      branchList[n] = i.replace(/^[ *]+/g, "");
    });
    branchList.sort();

    // create popup
    let popup = document.querySelector("#fun-git-branch-select");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "fun-git-branch-select";
      document.querySelector("#fun-git").appendChild(popup);
    }
    popup.replaceChildren();

    // close icon and heading
    const close = document.createElement("a");
    popup.appendChild(close);
    close.href = "#";
    const icon = document.createElement("img");
    close.appendChild(icon);
    icon.src = "img/win/close.svg";
    icon.width = "30";
    icon.height = "30";
    icon.alt = "";
    close.addEventListener("click", function (evt) {
      evt.preventDefault();
      git.branchSelectRemove();
    });
    const h2 = document.createElement("h2");
    popup.appendChild(h2);
    h2.textContent = "Branches";

    // fill popup
    for (const branch of branchList) {
      const a = document.createElement("a");
      popup.appendChild(a);
      a.classList.add("branch");
      a.href = "#";
      a.textContent = branch;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        git.commandBranch(this.textContent);
        git.branchSelectRemove();
      });
    }

    // show popup
    void popup.offsetWidth;
    popup.classList.add("visible");
  },

  // remove branch selector popup
  branchSelectRemove () {
    const popup = document.querySelector("#fun-git-branch-select");
    if (!popup?.classList?.contains("visible")) {
      return;
    }
    popup.addEventListener("transitionend", function () {
      this.parentNode.removeChild(this);
    }, {
      once: true,
    });
    popup.classList.remove("visible");
  },

  // execute a basic git command
  //   a = node
  async command (a) {
    await xml.updateWait();
    let command = a.id.replace("fun-git-", "");
    command = command.substring(0, 1).toUpperCase() + command.substring(1);
    git["command" + command]();
  },

  // show status
  async commandStatus () {
    let status = await git.commandExec("git status");
    if (status === false) {
      document.querySelector("#fun-git-status").focus();
      return;
    }
    status = shared.errorString(status);
    status = status.replace(/\t/g, "\u00A0".repeat(2));
    const win = document.querySelector("#dialog");
    win.classList.add("code");
    await dialog.open({
      type: "alert",
      text: status,
    });
    setTimeout(() => win.classList.remove("code"), 300);
  },

  // change branch
  //   branch = string | undefined
  async commandBranch (branch = "") {
    const current = await git.branchCurrent();
    let dest = branch;
    if (!dest) {
      const branches = await git.commandExec("git branch --list");
      if (branches) {
        const branchList = branches.split("\n");
        if (branchList.length > 2) {
          git.branchSelect(branchList);
          return;
        }
      }
      dest = current === "master" ? "preprint" : "master";
    }

    // Is the working tree clean?
    const clean = await git.branchClean();
    if (!clean) {
      document.querySelector("#fun-git-branch").focus();
      return;
    }

    // checkout branch
    const checkout = await git.commandExec(`git checkout ${dest}`);
    if (checkout === false) {
      document.querySelector("#fun-git-branch").focus();
      return;
    }
    git.branchCurrentPrint();
    shared.feedback("okay");
    xml.update();
  },

  // pull on current branch
  async commandPull () {
    // Is the working tree clean?
    const clean = await git.branchClean();
    if (!clean) {
      document.querySelector("#fun-git-pull").focus();
      return;
    }

    // Do I know the user's password?
    let { configPass } = git;
    if (!configPass) {
      const result = await dialog.open({
        type: "pass",
        text: `Passwort für <b>${git.config.user}@git.zdl.org</b>`,
      });
      if (!result) {
        return;
      }
      // Passwort auslesen
      configPass = document.querySelector("#dialog input").value.trim();
      if (!configPass) {
        shared.error("kein Passwort eingegeben");
        return;
      }
    }

    // Okay, let's pull it!
    const branches = [ await git.branchCurrent() ];
    branches.unshift(branches.includes("master") ? "preprint" : "master");
    for (const branch of branches) {
      const checkout = await git.commandExec(`git checkout ${branch}`);
      if (checkout === false) {
        document.querySelector("#fun-git-pull").focus();
        return;
      }
      const pull = await git.commandExec(`git pull https://${git.config.user}:${encodeURIComponent(configPass)}@${git.remote} ${branch}:origin/${branch}`);
      if (pull === false) {
        document.querySelector("#fun-git-pull").focus();
        return;
      }
    }
    git.configPass = configPass;
    shared.feedback("okay");
    xml.update();
  },

  // restore changed files
  async commandRestore () {
    // Is the working tree clean?
    const clean = await git.branchClean(false);
    if (clean) {
      dialog.open({
        type: "alert",
        text: "Der Branch ist sauber.\nEs können keine Dateien zurückgesetzt werden.",
      });
      return;
    }

    // Are you really going to do this?
    const confirm = await dialog.open({
      type: "confirm",
      text: '<b class="warn">ACHTUNG!</b>\nBeim Zurücksetzen der Dateien werden nicht committete Änderungen im Repository unwiederbringlich gelöscht!\n(Dateien im Unterordner <i>ignore</i> sind davon nicht betroffen.)\nWollen Sie die geänderten Dateien wirklich zurücksetzen?',
      wait: true,
    });
    if (!confirm) {
      return;
    }

    // restore known folders and files
    const folders = [
      "articles",
      "resources",
      "share",
      "README.md",
    ];
    const restore = await git.commandExec(`git restore ${folders.join(" ")}`);
    if (restore === false) {
      document.querySelector("#fun-git-restore").focus();
      return;
    }
    shared.feedback("okay");
    xml.update();
  },

  // execute a Git command
  //   command = string
  async commandExec (command) {
    const result = await new Promise(resolve => {
      const options = {
        cwd: git.config.dir,
        windowsHide: true,
      };
      shared.exec(command, options, (err, stdout, stderr) => {
        if (err) {
          resolve([ err.code, stderr.trim() ]);
        } else {
          resolve(stdout.trim());
        }
      });
    });

    // handle errors
    if (Array.isArray(result)) {
      await shared.error(`Fehlercode: ${result[0]}, ${result[1]}`);
      return false;
    }

    // return result
    return result;
  },

  // fill in preferences
  fillPrefs () {
    for (const [ k, v ] of Object.entries(git.config)) {
      const text = v.replace(/[/\\]/g, m => m + "<wbr>");
      document.querySelector(`#prefs-git-${k}`).innerHTML = text;
    }
  },
};


import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
} from "electron";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import dd from "./js/main/dd.mjs";
import error from "./js/main/error.mjs";
import popup from "./js/main/popup.mjs";
import prefs from "./js/main/prefs.mjs";
import pv from "./js/main/pv.mjs";
import services from "./js/main/services.mjs";
import win from "./js/main/win.mjs";
import xml from "./js/main/xml.mjs";

const __dirname = import.meta.dirname;


/* ERRORS --------------------------------------- */

process.on("uncaughtException", err => error.register(err));
process.on("unhandledRejection", err => error.register(err));


/* PREFERENCES ---------------------------------- */

for (const i of [ "about", "app", "help", "pv" ]) {
  prefs.data.win[i] = {
    x: -1,
    y: -1,
    width: 0,
    height: 0,
    maximized: false,
  };
}


/* WORKER WINDOW -------------------------------- */

const worker = {
  // data received from worker
  data: null,

  // make the worker work
  //   data = object
  async work (data) {
    // send data to existing worker window or create a new one
    const workerWin = win.data.find(i => i.type === "worker");
    if (workerWin) {
      workerWin.bw.webContents.send("work", data);
    } else {
      // create browser window
      const bw = new BrowserWindow({
        title: "QS / Worker",
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          backgroundThrottling: false,
          contextIsolation: true,
          defaultEncoding: "UTF-8",
          devTools: dd.dev,
          nodeIntegration: false,
          preload: path.join(__dirname, "js", "main", "preload.cjs"),
          sandbox: true,
        },
      });

      // memorize window
      win.data.push({
        bw,
        id: bw.id,
        contentsIds: [ bw.webContents.id ],
        type: "worker",
        wvBase: null,
        wvWeb: null,
        xml: null,
      });

      // load html
      const html = path.join(__dirname, "html", "worker.html");
      if (dd.dev) {
        // no cache while developing
        bw.loadURL("file://" + html, {
          extraHeaders: "pragma: no-cache\n",
        });
      } else {
        bw.loadFile(html);
      }

      // window is going to be closed
      bw.on("close", () => {
        const idx = win.data.findIndex(i => i.type === "worker");
        win.data.splice(idx, 1);
      });

      // send data
      bw.webContents.once("did-finish-load", function () {
        const bw = BrowserWindow.fromWebContents(this);
        bw.webContents.send("work", data);
      });
    }

    // wait for worker to finish
    worker.data = null;
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        worker.data = false;
        resolve(false);
      }, 6e4);
      const wait = setInterval(() => {
        if (worker.data !== null) {
          clearTimeout(timeout);
          clearInterval(wait);
          resolve(true);
        }
      }, 100);
    });
    return worker.data;
  },
};


/* APP EVENTS ----------------------------------- */

// parse CLI options
for (let i = 0, len = process.argv.length; i < len; i++) {
  const arg = process.argv[i].match(/^--([^\s=]+)(?:=(.+))?/);
  if (!arg || typeof dd.cliCommand[arg[1]] === "undefined") {
    // argument unknown
    continue;
  }
  let value = arg[2]?.replace(/^"|"$/g, "") || true;
  if (typeof value !== typeof dd.cliCommand[arg[1]]) {
    // value has different type => probably misusage (e.g. no path given)
    continue;
  }
  // ensure "export-out" path is absolute
  if (arg[1] === "export-out" && !path.isAbsolute(value)) {
    value = path.join(process.cwd(), value);
    value = path.normalize(value);
  }
  dd.cliCommand[arg[1]] = value;
}

const cliCommandFound = Object.values(dd.cliCommand).some(i => i === true) || dd.cliCommand["transform-svg"];
let cliReturnCode = -1;

// single instance lock
const locked = app.requestSingleInstanceLock(dd.cliCommand);

if (cliCommandFound || !locked) {
  // CLI COMMAND OR SECOND INSTANCE
  (async function () {
    // quit immediately if second instance without CLI command
    if (!cliCommandFound) {
      app.quit();
      process.exit(0);
    }

    // wait until app is ready
    await app.whenReady();

    // read preferences
    await prefs.read();

    // open hidden app window
    win.open({ type: "cli" });

    // wait until there is a valid return code
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (cliReturnCode >= 0) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });

    // quit app
    app.quit();
    process.exit(cliReturnCode);
  }());
} else {
  // NORMAL APP BEHAVIOR
  // focus existing app window in case a second instance is opened
  app.on("second-instance", (...args) => {
    if (Object.values(args[3]).some(i => i === true)) {
      return;
    }
    const app = win.data.find(i => i.type === "app");
    app.bw.focus();
  });

  // app initialized => open app window
  app.on("ready", async () => {
    // read preferences
    await prefs.read();
    // open app window
    win.open({ type: "app" });
  });

  // strengthen security for web contents:
  //   - disallow navigation to other pages
  //   - disallow creation of windows with window.open()
  app.on("web-contents-created", (evt, contents) => {
    contents.on("will-navigate", function (evt) {
      const mayNavigate = [];
      for (const i of win.data) {
        if (i.type !== "pv") {
          continue;
        }
        mayNavigate.push(i.wvWeb.webContents.id);
      }
      if (!mayNavigate.includes(this.id)) {
        // only allow navigation in preview windows and
        // only in those web contents that show the preview
        evt.preventDefault();
      }
    });
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
  });

  // quit app when every window is closed
  app.on("window-all-closed", async () => {
    // write preferences
    await prefs.write();
    // on macOS an app typically remains active
    // until the user quits it explicitly
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // reactivate app
  app.on("activate", () => {
    // on macOS the window object might already exist;
    // in this case, we don't need to create the app window
    let appWinExists = false;
    for (const i of win.data) {
      if (i.type === "app") {
        appWinExists = true;
        break;
      }
    }
    if (!appWinExists) {
      win.open({ type: "app" });
    }
  });
}


/* RENDERER REQUESTS ---------------------------- */

// Security: ensure that WebContents, which sent a request, have loaded a local file
function validSender (evt) {
  let validIds = [];
  for (const i of Object.values(win.data)) {
    validIds = validIds.concat(i.contentsIds);
  }
  if (!validIds.includes(evt.sender.id)) {
    return false;
  }
  try {
    const validURL = new URL(evt.senderFrame.url);
    if (validURL.protocol !== "file:") {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

ipcMain.handle("app-info", evt => {
  if (!validSender(evt)) {
    return {};
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  return {
    appPath: app.getAppPath(),
    documents: app.getPath("documents"),
    packaged: app.isPackaged,
    process: {
      platform: process.platform,
      resourcesPath: process.resourcesPath,
      versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node,
        v8: process.versions.v8,
      },
    },
    temp: app.getPath("temp"),
    userData: app.getPath("userData"),
    version: app.getVersion(),
    winId: bw.id,
  };
});

ipcMain.handle("cli-message", (evt, message) => {
  if (!validSender(evt)) {
    return;
  }
  console.log(message);
});

ipcMain.handle("cli-return-code", (evt, returnCode) => {
  if (!validSender(evt)) {
    return;
  }
  cliReturnCode = returnCode;
});

ipcMain.handle("close", evt => {
  if (!validSender(evt)) {
    return;
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  bw.close();
});

ipcMain.handle("command", async (evt, data) => {
  if (!validSender(evt)) {
    return [ 1, "invalid sender process" ];
  }

  // security measures
  //   - no new lines
  //   - no command chaining
  const splits = [ "\n", ";" ];
  for (let [ k, v ] of Object.entries(data)) {
    for (const i of splits) {
      v = v.split(i)[0];
    }
    data[k] = v;
  }

  // execute only valid commands
  const validCommands = [
    /^git branch /,
    /^git checkout /,
    /^git diff /,
    /^git ls-files /,
    /^git pull /,
    /^git restore /,
    /^git status$/,
  ];
  let allowed = false;
  for (const i of validCommands) {
    if (i.test(data.cmd)) {
      allowed = true;
      break;
    }
  }
  if (!allowed) {
    return [ 1, "command not allowed" ];
  }

  // execute command
  return await new Promise(resolve => {
    const opt = {
      windowsHide: true,
    };
    if (data.wd) {
      opt.cwd = data.wd;
    }
    exec(data.cmd, opt, (err, stdout, stderr) => {
      if (err) {
        resolve([ err.code, stderr.trim() ]);
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

ipcMain.handle("clear-cache", evt => {
  if (!validSender(evt)) {
    return false;
  }
  const bw = win.data.find(i => i.type === "app")?.bw;
  if (bw) {
    const ses = bw.webContents.session;
    ses.clearCache();
    return true;
  }
  return false;
});

ipcMain.handle("help", (evt, data) => {
  if (!validSender(evt)) {
    return;
  }
  win.help(data);
});

ipcMain.handle("error", (evt, err) => {
  if (!validSender(evt)) {
    return;
  }
  error.log(err);
});

ipcMain.handle("exists", async (evt, path) => {
  if (!validSender(evt)) {
    return false;
  }
  const result = await services.exists(path);
  return result;
});

ipcMain.handle("file-access-write", async (evt, path) => {
  if (!validSender(evt)) {
    return false;
  }
  try {
    await fs.access(path, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("file-copy", async (evt, src, dest) => {
  if (!validSender(evt)) {
    return;
  }
  await fs.copyFile(src, dest, fs.constants.COPYFILE_EXCL);
});

ipcMain.handle("file-dialog", async (evt, open, options) => {
  if (!validSender(evt)) {
    return null;
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  const result = await services.fileDialog({
    bw,
    open,
    options,
  });
  return result;
});

ipcMain.handle("file-read", async (evt, path) => {
  if (!validSender(evt)) {
    return {
      name: "Illegal Usage",
      message: "invalid sender process",
    };
  }
  try {
    const cont = await fs.readFile(path, {
      encoding: "utf8",
    });
    return cont;
  } catch (err) {
    return err;
  }
});

ipcMain.handle("file-readdir", async (evt, path) => {
  if (!validSender(evt)) {
    return {
      name: "Illegal Usage",
      message: "invalid sender process",
    };
  }
  try {
    const dir = await fs.readdir(path);
    return dir;
  } catch (err) {
    return err;
  }
});

ipcMain.handle("file-unlink", async (evt, path) => {
  if (!validSender(evt)) {
    return {
      name: "Illegal Usage",
      message: "invalid sender process",
    };
  }
  try {
    await fs.unlink(path);
    return true;
  } catch (err) {
    return err;
  }
});

ipcMain.handle("file-write", async (evt, path, cont) => {
  if (!validSender(evt)) {
    return {
      name: "Illegal Usage",
      message: "invalid sender process",
    };
  }
  try {
    await fs.writeFile(path, cont);
    return true;
  } catch (err) {
    return err;
  }
});

ipcMain.handle("git-config", evt => {
  if (!validSender(evt)) {
    return {};
  }
  return prefs.data.git;
});

ipcMain.handle("git-save", (evt, config) => {
  if (!validSender(evt)) {
    return;
  }
  prefs.data.git = config;
  prefs.write();
});

ipcMain.handle("list-of-images", async evt => {
  if (!validSender(evt)) {
    return [];
  }
  const result = await services.svg();
  return result;
});

ipcMain.handle("open-external", (evt, url) => {
  if (!validSender(evt)) {
    return;
  }
  shell.openExternal(url);
});

ipcMain.handle("open-path", async (evt, path) => {
  if (!validSender(evt)) {
    return "invalid sender process";
  }
  // weird Electron BUG (Electron 38.2.0, 2025-09-30):
  // openPath() will not execute if console.log() is not called prior to the method;
  // "void path" and different approaches (e.g. no await) did not work;
  // furthermore, the promise is never fullfilled
  console.log(path);
  return await shell.openPath(path);
});

ipcMain.handle("path-info", async (evt, path) => {
  if (!validSender(evt)) {
    return {};
  }
  const stats = await fs.lstat(path);
  return {
    isDirectory: stats?.isDirectory(),
    isFile: stats?.isFile(),
  };
});

ipcMain.handle("path-join", (evt, ...arr) => {
  if (!validSender(evt)) {
    return "";
  }
  return path.join(...arr);
});

ipcMain.handle("path-parse", (evt, p) => {
  if (!validSender(evt)) {
    return {};
  }
  return path.parse(p);
});

ipcMain.handle("popup", (evt, items) => {
  if (!validSender(evt)) {
    return;
  }
  popup.make(evt.sender, items);
});

ipcMain.handle("prefs", evt => {
  if (!validSender(evt)) {
    return {};
  }
  return prefs.data.options;
});

ipcMain.handle("prefs-save", async (evt, options) => {
  if (!validSender(evt)) {
    return;
  }
  prefs.data.options = options;
  await prefs.write();
  if (typeof prefs.saved !== "undefined") {
    prefs.saved = true;
  }
});

ipcMain.handle("pv", (evt, args) => {
  if (!validSender(evt)) {
    return;
  }
  pv.open(args);
});

ipcMain.handle("pv-close-all", evt => {
  if (!validSender(evt)) {
    return;
  }
  pv.closeAll();
});

ipcMain.handle("pv-nav", (evt, data) => {
  if (!validSender(evt)) {
    return;
  }
  const { bw } = win.data.find(i => i.id === data.winId);
  pv.nav(bw, data.action);
});

ipcMain.handle("pv-new", evt => {
  if (!validSender(evt)) {
    return;
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  pv.openNew(bw);
});

ipcMain.handle("xml-files", async (evt, repoDir) => {
  if (!validSender(evt)) {
    return {};
  }
  const result = await xml.getFiles(repoDir);
  return result;
});

ipcMain.handle("xml-worker-done", (evt, data) => {
  if (!validSender(evt)) {
    return;
  }
  worker.data = data;
});

ipcMain.handle("xml-worker-work", async (evt, data) => {
  if (!validSender(evt)) {
    return null;
  }
  const result = await worker.work(data);
  return result;
});

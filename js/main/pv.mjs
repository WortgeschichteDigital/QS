
import { BaseWindow } from "electron";
import path from "node:path";

import error from "./error.mjs";
import services from "./services.mjs";
import win from "./win.mjs";
import xml from "./xml.mjs";

const __dirname = new URL(".", import.meta.url).pathname;

export { pv as default };

const pv = {
  // open a new preview window or reload the XML file into an already existing one
  //   args = object (either "winId" or the other keys are present)
  //     dir = string (articles | ignore)
  //     file = string (XML file name)
  //     git = string (path to git directory)
  //     winId = integer (window ID)
  open (args) {
    for (const i of win.data) {
      if (!args.winId && i.xml?.file === args.file ||
          args.winId && i.id === args.winId) {
        pv.load(i.bw, i.xml);
        return;
      }
    }
    win.open({
      type: "pv",
      xml: args,
    });
  },

  // open a new instance of an already existing preview window
  //   bw = base window
  openNew (bw) {
    const data = win.data.find(i => i.id === bw.id);
    win.open({
      type: "pv",
      xml: data.xml,
    });
  },

  // close all preview windows
  closeAll () {
    const exclude = [];
    for (const w of win.data) {
      if (w.type !== "pv") {
        exclude.push(w.type);
      }
    }
    win.closeAll(exclude);
  },

  // set bounds for the views of the given preview window
  //   bw = base window
  setBounds (bw) {
    // header height: 78px height + 3px margin
    const headerHeight = 81;

    // get browser window dimensions
    const [ width, height ] = bw.getContentSize();

    // find web contents
    const { wvBase, wvWeb } = win.data.find(i => i.id === bw.id);

    // set bounds: base
    wvBase.setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });

    // set bounds: web
    wvWeb.setBounds({
      x: 0,
      y: headerHeight,
      width,
      height: height - headerHeight,
    });
  },

  // load the XML preview into a given base window
  //   bw = base window
  //   args = object (see win.data)
  async load (bw, args) {
    // get XML file
    const xmlPath = path.join(args.git, args.dir, args.file);
    const exists = await services.exists(xmlPath);
    let xmlFile = "";
    if (exists) {
      const xmlFiles = await xml.getFile(args.git, args.dir, args.file);
      if (xmlFiles[args.file]) {
        xmlFile = xmlFiles[args.file].xml;
        // update file data in main window
        const appWin = win.data.find(i => i.type === "app");
        appWin.bw.webContents.send("update-file", xmlFiles);
      }
    }

    // no XML data found => error message
    const { wvBase, wvWeb } = win.data.find(i => i.id === bw.id);
    if (!xmlFile) {
      pv.loadingError(wvBase, wvWeb, `Die Daten aus der Datei „${args.file}“ konnten nicht geladen werden.`);
      return;
    }

    // try to restore the scroll position on reload
    const wc = wvWeb.webContents;
    const url = new URL(wc.getURL());
    let scrollTop = 0;
    if (url.host === "www.zdl.org" && url.pathname === "/wb/wortgeschichten/pv") {
      try {
        const result = await wc.executeJavaScript(`
          window.pageYOffset;
        `);
        const top = parseInt(result, 10);
        if (!isNaN(top)) {
          scrollTop = top;
        }
      } catch {}
    }

    // load preview
    try {
      // load page
      const bytes = Buffer.from(`xml=${encodeURIComponent(xmlFile)}`);
      await wc.loadURL("https://www.zdl.org/wb/wortgeschichten/pv?bn=mark", {
        postData: [
          {
            type: "rawData",
            bytes,
          },
        ],
        extraHeaders: "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
      });

      // restore scroll position
      if (scrollTop) {
        wc.executeJavaScript(`
          window.scrollTo(0, ${scrollTop});
        `);
      }

      // finish up loading
      pv.loadingDone(wvBase, wvWeb);
    } catch (err) {
      // failed to load the preview => error message
      wc.stop();
      pv.loadingError(wvBase, wvWeb, error.errorString(err.message));
    }

    // focus window
    // (this is important in case the window already exists)
    bw.focus();
  },

  // finish up the loading procedure
  //   wvBase = view
  //   wvWeb = view
  loadingDone (wvBase, wvWeb) {
    wvWeb.webContents.navigationHistory.clear();
    wvBase.webContents.send("update-icons", {
      canGoBack: false,
      canGoForward: false,
    });
  },

  // show error document on loading failures
  //   wvBase = view
  //   wvWeb = view
  //   message = string
  async loadingError (wvBase, wvWeb, message) {
    try {
      await wvWeb.webContents.loadFile(path.join(__dirname, "..", "..", "html", "pvError.html"));
      pv.loadingDone(wvBase, wvWeb);
      wvWeb.webContents.executeJavaScript(`
        let label = document.createElement("p");
        label.classList.add("label");
        label.textContent = "Fehlermeldung";
        document.body.appendChild(label);
        let err = document.createElement("p");
        err.innerHTML = "${message}";
        document.body.appendChild(err);
      `);
    } catch {
      wvWeb.webContents.stop();
      pv.loadingDone(wvBase, wvWeb);
    }
  },

  // change zoom of the web view
  //   action = string
  zoom (action) {
    const bw = BaseWindow.getFocusedWindow();
    const { wvWeb } = win.data.find(i => i.id === bw.id);
    let level = wvWeb.webContents.getZoomLevel();
    switch (action) {
      case "in":
        level++;
        break;
      case "out":
        level--;
        break;
      case "original":
        level = 0;
        break;
    }
    wvWeb.webContents.setZoomLevel(level);
  },

  // navigate within a web contents
  //   bw = base window
  //   action = string
  nav (bw, action) {
    const { wvWeb } = win.data.find(i => i.id === bw.id);
    if (action === "goBack") {
      wvWeb.webContents.navigationHistory.goBack();
    } else if (action === "goForward") {
      wvWeb.webContents.navigationHistory.goForward();
    }
  },
};

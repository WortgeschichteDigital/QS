"use strict";

const pv = {
  // received XML data
  //   dir = string (articles | ignore)
  //   file = string (XML file name)
  //   git = string (path to git directory)
  //   xml = string (XML file content)
  data: {},

  // show XML preview on zdl.org
  async xml () {
    if (!pv.data.xml) {
      pv.xmlNotFound();
      return;
    }

    // try to restore the scroll position on reload
    const wv = document.querySelector("webview");
    const url = new URL(wv.getURL());
    let scrollTop = 0;
    if (url.host === "www.zdl.org" && url.pathname === "/wb/wortgeschichten/pv") {
      await new Promise(resolve => {
        wv.executeJavaScript(`
          window.pageYOffset;
        `)
          .then(result => {
            const top = parseInt(result, 10);
            if (!isNaN(top)) {
              scrollTop = top;
            }
            resolve(true);
          })
          .catch(() => resolve(true));
      });
    }

    // load preview
    wv.loadURL("https://www.zdl.org/wb/wortgeschichten/pv?bn=mark", {
      postData: [
        {
          type: "rawData",
          bytes: Buffer.from(`xml=${encodeURIComponent(pv.data.xml)}`),
        },
      ],
      extraHeaders: "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
    })
      .then(() => {
        if (scrollTop) {
          // restore scroll position
          wv.executeJavaScript(`
            window.scrollTo(0, ${scrollTop});
          `);
        }
        pv.loadingDone(wv);
      })
      .catch(err => {
        wv.stop();
        wv.loadURL("file://" + modules.path.join(shared.info.appPath, "html", "pvError.html"))
          .then(() => {
            pv.loadingDone(wv);
            wv.executeJavaScript(`
              let label = document.createElement("p");
              label.classList.add("label");
              label.textContent = "Fehlermeldung";
              document.body.appendChild(label);
              let err = document.createElement("p");
              err.innerHTML = "${shared.errorString(err.message)}";
              document.body.appendChild(err);
            `);
          })
          .catch(() => {
            wv.stop();
            pv.loadingDone(wv);
          });
      });
  },

  // show error document if XML file was not found (anymore)
  xmlNotFound () {
    const wv = document.querySelector("webview");
    wv.loadURL("file://" + modules.path.join(shared.info.appPath, "html", "pvError.html"))
      .then(() => {
        pv.loadingDone(wv);
        wv.executeJavaScript(`
          let label = document.createElement("p");
          label.classList.add("label");
          label.textContent = "Fehlermeldung";
          document.body.appendChild(label);
          let err = document.createElement("p");
          err.innerHTML = "Die Daten aus der Datei „${pv.data.file}“ konnten nicht geladen werden.";
          document.body.appendChild(err);
        `);
      })
      .catch(() => {
        wv.stop();
        pv.loadingDone(wv);
      });
  },

  // finish up the loading procedure
  //   wv = node (<webview>)
  loadingDone (wv) {
    document.querySelector("#update img").classList.remove("rotate");
    wv.clearHistory();
    pv.updateIcons();
  },

  // update the navigation icons
  updateIcons () {
    const wv = document.querySelector("webview");
    for (const i of [ "back", "forward" ]) {
      const icon = document.querySelector(`#${i} img`);
      if (i === "back" && wv.canGoBack() ||
          i === "forward" && wv.canGoForward()) {
        icon.src = `../img/win/nav-${i}-white.svg`;
      } else {
        icon.src = `../img/win/nav-${i}-grey.svg`;
      }
    }
  },

  // request an updated XML file
  updateXml () {
    document.querySelector("#update img").classList.add("rotate");
    modules.ipc.invoke("pv", {
      dir: pv.data.dir,
      file: pv.data.file,
      git: pv.data.git,
      winId: shared.info.winId,
    });
  },

  // open the same article in another window
  newWin () {
    modules.ipc.invoke("pv-new", {
      dir: pv.data.dir,
      file: pv.data.file,
      git: pv.data.git,
      winId: shared.info.winId,
    });
  },

  // navigation
  //   action = string
  nav (action) {
    const wv = document.querySelector("webview");
    switch (action) {
      case "back":
        wv.goBack();
        break;
      case "forward":
        wv.goForward();
        break;
      case "new":
        pv.newWin();
        break;
      case "update":
        pv.updateXml();
        break;
      case "xml":
        pv.xml();
        break;
    }
  },
};

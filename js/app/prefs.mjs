
import artikel from "./artikel.mjs";
import bars from "./bars.mjs";
import git from "./git.mjs";
import misc from "./misc.mjs";
import viewClusters from "./viewClusters.mjs";
import viewHints from "./viewHints.mjs";
import viewSearch from "./viewSearch.mjs";
import viewXml from "./viewXml.mjs";
import xml from "./xml.mjs";

import dialog from "../dialog.mjs";
import shared from "../shared.mjs";

export { prefs as default };

const prefs = {
  // preferences data as received from main
  data: {},

  // initialize preferences at startup
  //   dataLoaded = boolean
  async init (dataLoaded) {
    if (!dataLoaded) {
      prefs.data = await bridge.ipc.invoke("prefs");
    }
    for (const [ k, v ] of Object.entries(prefs.data)) {
      // option not within the preferences overlay
      if (/app-version|marks/.test(k)) {
        continue;
      } else if (k === "filters") {
        prefs.initFilters();
        continue;
      } else if (k === "search") {
        prefs.initSearch();
        continue;
      } else if (k === "sorting") {
        prefs.initSorting();
        continue;
      }

      // option within the preferences overlay
      const ele = document.getElementById(`prefs-${k}`);
      if (!ele) {
        delete prefs.data[k];
        continue;
      }
      if (ele.type === "text") {
        ele.value = v;
      }
    }

    // read Zeitstrahl data if file path present
    if (prefs.data.zeitstrahl) {
      await prefs.zeitstrahlRead(prefs.data.zeitstrahl);
    }

    // read resources data if file path present
    if (prefs.data.ressourcen) {
      await prefs.ressourcenRead(prefs.data.ressourcen);
    }
  },

  // initialize filter options at startup
  initFilters () {
    for (const [ k, v ] of Object.entries(prefs.data.filters)) {
      if (k === "bar-visible" && v) {
        document.getElementById("fun-filters").click();
      } else if (/^select-/.test(k)) {
        document.getElementById(k).dataset.value = v;
      } else {
        const ele = document.getElementById(k);
        if (!ele) {
          delete prefs.data.filters[k];
          continue;
        }
        ele.checked = v;
      }
    }
  },

  // initialize sorting options at startup
  initSorting () {
    for (const [ k, v ] of Object.entries(prefs.data.sorting)) {
      if (k === "ascending") {
        const dir = document.getElementById("sorting-dir");
        const img = dir.querySelector("img");
        if (v) {
          img.src = "img/sort-ascending.svg";
          dir.dataset.tooltip = "<i>Sortierung:</i> aufsteigend";
        } else {
          img.src = "img/sort-descending.svg";
          dir.dataset.tooltip = "<i>Sortierung:</i> absteigend";
        }
      } else if (k === "filter") {
        document.getElementById("sorting-filter").value = v;
      } else if (k === "ignore") {
        const ignore = document.getElementById("sorting-ignore");
        if (v) {
          ignore.classList.add("active");
        } else {
          ignore.classList.remove("active");
        }
      } else if (k === "type") {
        document.getElementById(`sorting-${v}`).classList.add("active");
        document.getElementById(`sorting-${v === "alpha" ? "time" : "alpha"}`).classList.remove("active");
      }
    }
  },

  // initialize advanced search options at startup
  initSearch () {
    for (const [ id, checked ] of Object.entries(prefs.data.search)) {
      const opt = document.getElementById(id);
      if (opt) {
        opt.checked = checked;
      }
    }
  },

  // save preferences data
  save () {
    // fill in filter data
    prefs.data.filters = bars.filtersGetData();
    prefs.data.filters["bar-visible"] = document.getElementById("fun-filters").classList.contains("active");

    // fill in sorting data
    prefs.data.sorting = misc.sortingGetData();

    // fill in search data
    prefs.data.search = viewSearch.getAdvancedData();

    // save preferences
    bridge.ipc.invoke("prefs-save", prefs.data);
  },

  // change section
  //   a = node (toc item)
  changeSection (a) {
    if (a.classList.contains("active")) {
      return;
    }
    const toc = document.querySelectorAll("li a");
    for (const i of toc) {
      if (i === a) {
        i.classList.add("active");
      } else {
        i.classList.remove("active");
      }
    }
    const sections = document.querySelectorAll(".prefs-section");
    const show = "prefs-" + a.getAttribute("href").substring(1);
    for (const i of sections) {
      if (i.id === show) {
        i.classList.remove("off");
      } else {
        i.classList.add("off");
      }
    }
  },

  // reconfigure Git
  gitConfig () {
    git.configFormShow();
    // update if dir was changed (wait for config to be closed)
    const { dir } = git.config;
    const win = document.getElementById("git");
    const interval = setInterval(() => {
      if (win.classList.contains("hide")) {
        clearInterval(interval);
        if (dir !== git.config.dir) {
          xml.update();
        }
      }
    }, 50);
  },

  // Zeistrahl: choose data.json
  async zeitstrahlOpen () {
    const options = {
      title: "Zeitstrahldaten auswählen",
      defaultPath: shared.info.documents,
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
      properties: [ "openFile" ],
    };
    const result = await bridge.ipc.invoke("file-dialog", true, options);
    if (result.canceled || !result?.filePaths?.length) {
      return;
    }
    const [ path ] = result.filePaths;
    const read = await prefs.zeitstrahlRead(path, false);
    if (!read) {
      return;
    }
    document.getElementById("prefs-zeitstrahl").value = path;
    prefs.data.zeitstrahl = path;
    prefs.save();
    artikel.messages();
  },

  // Zeistrahl: read data file
  //   path = string
  //   passive = false | undefined
  async zeitstrahlRead (path, passive = true) {
    const content = await bridge.ipc.invoke("file-read", path);
    if (typeof content !== "string") {
      return false;
    }
    let zsData;
    try {
      zsData = JSON.parse(content);
    } catch (err) {
      if (!passive) {
        shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      }
      return false;
    }
    if (!zsData.fields || !zsData.lemmas) {
      if (!passive) {
        shared.error("Datei enthält keine Zeitstrahldaten");
      }
      return false;
    }
    artikel.zeitstrahl = zsData;
    return true;
  },

  // Zeistrahl: remove link to data file
  zeitstrahlRemove () {
    if (!prefs.data.zeitstrahl) {
      return;
    }
    document.getElementById("prefs-zeitstrahl").value = "";
    delete prefs.data.zeitstrahl;
    prefs.save();
    artikel.zeitstrahl = {};
    artikel.messages();
  },

  // Ressourcen: choose data.json
  async ressourcenOpen () {
    const options = {
      title: "Ressourcendaten auswählen",
      defaultPath: shared.info.documents,
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
      properties: [ "openFile" ],
    };
    const result = await bridge.ipc.invoke("file-dialog", true, options);
    if (result.canceled || !result?.filePaths?.length) {
      return;
    }
    const [ path ] = result.filePaths;
    const read = await prefs.ressourcenRead(path, false);
    if (!read) {
      return;
    }
    document.getElementById("prefs-ressourcen").value = path;
    prefs.data.ressourcen = path;
    prefs.save();
    artikel.messages();
  },

  // Ressourcen: read data file
  //   path = string
  //   passive = false | undefined
  async ressourcenRead (path, passive = true) {
    const content = await bridge.ipc.invoke("file-read", path);
    if (typeof content !== "string") {
      return false;
    }
    let resData;
    try {
      resData = JSON.parse(content);
    } catch (err) {
      if (!passive) {
        shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      }
      return false;
    }
    const [ firstLemma ] = Object.keys(resData);
    if (!resData[firstLemma].d.checked || typeof resData[firstLemma].d.found === "undefined") {
      if (!passive) {
        shared.error("Datei enthält keine Ressourcendaten");
      }
      return false;
    }
    artikel.ressourcen = resData;
    return true;
  },

  // Ressourcen: remove link to data file
  ressourcenRemove () {
    if (!prefs.data.ressourcen) {
      return;
    }
    document.getElementById("prefs-ressourcen").value = "";
    delete prefs.data.ressourcen;
    prefs.save();
    artikel.ressourcen = {};
    artikel.messages();
  },

  // ZDL-Repository: choose directory
  async zdlOpen () {
    // open dialog
    const options = {
      title: "ZDL-Repository auswählen",
      defaultPath: shared.info.documents,
      properties: [ "openDirectory" ],
    };
    const result = await bridge.ipc.invoke("file-dialog", true, options);
    if (result.canceled || !result?.filePaths?.length) {
      return;
    }

    // check path
    const [ path ] = result.filePaths;
    const structure = {
      ".git": false,
      root: false,
    };
    const files = await bridge.ipc.invoke("file-readdir", path);
    if (!Array.isArray(files)) {
      shared.error(`${files.name}: ${files.message} (${shared.errorReduceStack(files.stack)})`);
      return;
    }
    for (const f of files) {
      structure[f] = true;
    }
    if (Object.values(structure).some(i => !i)) {
      const missing = [];
      for (const [ k, v ] of Object.entries(structure)) {
        if (!v) {
          missing.push("• " + k);
        }
      }
      await dialog.open({
        type: "alert",
        text: `Folgende Unterordner wurden im Repository nicht gefunden:\n${missing.join("<br>")}`,
      });
      return;
    }

    // accept path
    document.getElementById("prefs-zdl").value = path;
    prefs.data.zdl = path;
    prefs.save();
  },

  // ZDL-Repository: remove link to directory
  zdlRemove () {
    if (!prefs.data.zdl) {
      return;
    }
    document.getElementById("prefs-zdl").value = "";
    delete prefs.data.zdl;
    prefs.save();
  },

  // export preferences data
  async exportData () {
    const [ today ] = new Date().toISOString().split("T");
    const options = {
      title: "Einstellungen speichern",
      defaultPath: await bridge.ipc.invoke("path-join", shared.info.documents, "resources", `QS_Einstellungen_${today}.json`),
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
    };
    const result = await bridge.ipc.invoke("file-dialog", false, options);
    if (result.canceled || !result.filePath) {
      return;
    }
    const data = structuredClone(prefs.data);
    data.zeitstrahl = "";
    data.ressourcen = "";
    data.zdl = "";
    data["app-version"] = "";
    const written = await bridge.ipc.invoke("file-write", result.filePath, JSON.stringify(data));
    if (written !== true) {
      shared.error(`${written.name}: ${written.message} (${shared.errorReduceStack(written.stack)})`);
    }
  },

  // import preferences data
  async importData () {
    // open data file
    const options = {
      title: "Einstellungen wiederherstellen",
      defaultPath: shared.info.documents,
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
      properties: [ "openFile" ],
    };
    const result = await bridge.ipc.invoke("file-dialog", true, options);
    if (result.canceled || !result?.filePaths?.length) {
      return;
    }
    const [ path ] = result.filePaths;
    const content = await bridge.ipc.invoke("file-read", path);
    if (typeof content !== "string") {
      shared.error("Datei konnte nicht geladen werden");
      return;
    }
    let json;
    try {
      json = JSON.parse(content);
      if (!json.filters || !json.sorting || !json.search) {
        shared.error("Datei enthält keine QS-Einstellungen");
        return;
      }
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      return;
    }

    // apply data
    prefs.zeitstrahlRemove();
    prefs.ressourcenRemove();
    prefs.zdlRemove();
    prefs.data = json;
    prefs.data["app-version"] = shared.info.version;
    await prefs.init(true);
    prefs.save();

    // update filters
    document.querySelectorAll(".select-filter").forEach(i => bars.selectFill(i));
    bars.filtersActive();
    viewSearch.toggleAdvancedIcon();

    // update active view and show feedback
    viewClusters.contentState.xmlDate = "";
    viewHints.contentState.xmlDate = "";
    viewXml.contentState.xmlDate = "";
    misc.viewPopulate("update");
    shared.feedback("okay");
  },

  // clear the HTML cache
  async clearHTMLCache () {
    const result = await bridge.ipc.invoke("clear-cache");
    let text = "Der HTML-Cache wurde geleert.";
    if (!result) {
      text = "Beim Leeren des HTMl-Caches ist ein <strong>Fehler</strong> aufgetreten.";
    }
    dialog.open({
      type: "alert",
      text,
    });
  },

  // statistical data
  statsData: [],

  // update statistical data
  //   type = string (clusters | search | update)
  //   start = date (object)
  stats (type, start) {
    // add new entry
    prefs.statsData.push({
      duration: new Date() - start,
      type,
    });

    // sort entries
    prefs.statsData.sort((a, b) => {
      if (a.type === b.type) {
        return 0;
      }
      const x = [ a.type, b.type ];
      x.sort();
      if (x[0] === a.type) {
        return 1;
      }
      return -1;
    });

    // update prefs page
    const typeSwitch = {
      clusters: "Cluster",
      search: "Suche",
      update: "Update",
    };
    const cont = document.getElementById("prefs-statistics-cont");
    let lastType = "";
    cont.replaceChildren();
    for (let i = prefs.statsData.length - 1; i >= 0; i--) {
      const item = prefs.statsData[i];
      if (item.type !== lastType) {
        const h3 = document.createElement("h3");
        cont.appendChild(h3);
        h3.textContent = typeSwitch[item.type];
        lastType = item.type;
      }
      const p = document.createElement("p");
      cont.appendChild(p);
      p.textContent = item.duration + "\u00A0ms";
    }
  },
};

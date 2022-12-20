"use strict";

let prefs = {
  // preferences data as received from main
  data: {},

  // initialize preferences at startup
  async init () {
    prefs.data = await shared.ipc.invoke("prefs");
    for (const [k, v] of Object.entries(prefs.data)) {
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
      const ele = document.querySelector(`#prefs-${k}`);
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
  },

  // initialize filter options at startup
  initFilters () {
    for (const [k, v] of Object.entries(prefs.data.filters)) {
      if (k === "bar-visible" && v) {
        document.querySelector("#fun-filters").click();
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
    for (const [k, v] of Object.entries(prefs.data.sorting)) {
      if (k === "ascending" && !v) {
        document.querySelector("#sorting-dir img").src = "img/app/sort-descending.svg";
        document.querySelector("#sorting-dir").dataset.tooltip = "<i>Sortierung:</i> absteigend";
      } else if (k === "filter") {
        document.querySelector("#sorting-filter").value = v;
      } else if (k === "ignore" && !v) {
        document.querySelector("#sorting-ignore").classList.remove("active");
      } else if (k === "type") {
        document.querySelector(`#sorting-${v}`).classList.add("active");
        document.querySelector(`#sorting-${v === "alpha" ? "time" : "alpha"}`).classList.remove("active");
      }
    }
  },

  // initialize advanced search options at startup
  initSearch () {
    for (const [id, checked] of Object.entries(prefs.data.search)) {
      const opt = document.getElementById(id);
      if (opt) {
        opt.checked = checked;
      }
    }
  },

  // save preferences data
  save () {
    // fill in filter data
    prefs.data.filters = bars.getFiltersData();
    prefs.data.filters["bar-visible"] = document.querySelector("#fun-filters").classList.contains("active");
    // fill in sorting data
    prefs.data.sorting = app.getSortingData();
    // fill in search data
    prefs.data.search = viewSearch.getAdvancedData();
    // save preferences
    shared.ipc.invoke("prefs-save", prefs.data);
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
    const dir = git.config.dir;
    const win = document.querySelector("#git");
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
      title: "Zeitstrahldatei auswählen",
      defaultPath: shared.info.documents,
      filters: [
        {
          name: "JSON",
          extensions: ["json"],
        },
      ],
      properties: [
        "openFile",
      ],
    };
    const result = await shared.ipc.invoke("file-dialog", true, options);
    if (result.canceld || !result?.filePaths?.length) {
      return;
    }
    const path = result.filePaths[0];
    const read = await prefs.zeitstrahlRead(path, false);
    if (!read) {
      return;
    }
    document.querySelector("#prefs-zeitstrahl").value = path;
    prefs.data.zeitstrahl = path;
    prefs.save();
  },

  // Zeistrahl: read data file
  //   path = string
  //   passive = false | undefined
  async zeitstrahlRead (path, passive = true) {
    let content;
    try {
      content = await shared.fsp.readFile(path, { encoding: "utf8" });
    } catch {
      return false;
    }
    let zsData;
    try {
      zsData = JSON.parse(content);
    } catch (err) {
      if (!passive) {
        shared.error(`${err.name}: ${err.message} (${shared.reduceErrorStack(err.stack)})`);
      }
      return false;
    }
    if (!zsData.fields || !zsData.lemmas) {
      if (!passive) {
        shared.error("Datei enthält keine Zeitstrahldaten");
      }
      return false;
    }
    xml.zeitstrahl = zsData;
    if (!passive) {
      xml.resetCache();
    }
    return true;
  },

  // Zeistrahl: remove link to data file
  zeitstrahlRemove () {
    if (!prefs.data.zeitstrahl) {
      return;
    }
    document.querySelector("#prefs-zeitstrahl").value = "";
    delete prefs.data.zeitstrahl;
    prefs.save();
    xml.zeitstrahl = {};
    xml.resetCache();
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
      let x = [a.type, b.type];
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
    let cont = document.querySelector("#prefs-statistics-cont");
    let lastType = "";
    shared.clear(cont);
    for (let i = prefs.statsData.length - 1; i >= 0; i--) {
      const item = prefs.statsData[i];
      if (item.type !== lastType) {
        let h3 = document.createElement("h3");
        cont.appendChild(h3);
        h3.textContent = typeSwitch[item.type];
        lastType = item.type;
      }
      let p = document.createElement("p");
      cont.appendChild(p);
      p.textContent = item.duration + "\u00A0ms";
    }
  },
};

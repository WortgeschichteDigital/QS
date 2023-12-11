"use strict";

var win = {
  // app is ready for interaction
  ready: false,

  // app is about to switch the view
  switching: false,

  // active view
  // (value is the same as the ID of the corresponding <section>)
  view: "xml",

  // clear a text field
  //   clear = node (the clear icon)
  clearTextField (clear) {
    const input = clear.previousSibling;
    input.value = "";
    input.focus();
    if (/sorting-filter|clusters-modulate-search/.test(input.id)) {
      input.dispatchEvent(new Event("input"));
    }
  },

  // execute a menu command
  async menuCommand (command) {
    if (overlay.top() === "git") {
      dialog.open({
        type: "alert",
        text: "Sie müssen erst die Git-Konfiguration abschließen.",
      });
      return;
    }
    if (!win.ready) {
      dialog.open({
        type: "alert",
        text: "Die App ist noch nicht bereit.",
      });
      return;
    }
    switch (command) {
      case "app-updates":
        updates.check(false);
        break;
      case "artikel-json":
        artikel.show();
        break;
      case "clusters":
        document.querySelector("#view-clusters").click();
        break;
      case "error-log":
        error.showLog();
        break;
      case "filters":
        document.querySelector("#fun-filters").click();
        break;
      case "hints":
        document.querySelector("#view-hints").click();
        break;
      case "overview":
        overview.show();
        break;
      case "preferences":
        overlay.show("prefs");
        break;
      case "search":
        await win.viewToggle(document.querySelector("#view-search"));
        viewSearch.toggleAdvanced("on");
        break;
      case "svg":
        svg.show();
        break;
      case "teaser-tags":
        tags.show();
        break;
      case "term":
        term.show();
        break;
      case "update":
        xml.update();
        break;
      case "xml":
        document.querySelector("#view-xml").click();
        break;
    }
  },

  // load XSL to variable
  //   obj = object
  //   key = string
  //   xsl = string
  async loadXsl ({ obj, key, xsl }) {
    if (obj[key]) {
      return true;
    }
    let resources = process.resourcesPath;
    if (/node_modules/.test(resources)) {
      // app is not packaged => process.resourcesPath is the path to the Electron resources
      resources = modules.path.join(shared.info.appPath, "resources");
    }
    try {
      const path = modules.path.join(resources, xsl);
      const result = await modules.fsp.readFile(path, { encoding: "utf8" });
      if (!obj[key]) {
        obj[key] = result;
      }
      return true;
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      return false;
    }
  },

  // print placeholder message in case there's nothing to show
  // (which usually happens when the filters are to tight)
  //   textWarn = string | undefined
  //   textTip = string | undefined
  nothingToShow (textWarn = "", textTip = "") {
    const div = document.createElement("div");
    div.classList.add("nothing");
    const warn = document.createElement("p");
    div.appendChild(warn);
    warn.textContent = textWarn || "Nichts gefunden!";
    const hint = document.createElement("p");
    div.appendChild(hint);
    let tip = textTip || "";
    if (/hints|xml/.test(win.view) && !Object.keys(xml.files).length) {
      tip = "Tipp: Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden.";
    } else if (!tip && win.view === "search") {
      const dataA = viewSearch.getAdvancedData();
      const tips = [];
      if (document.querySelector("#fun-filters.active-filters")) {
        tips.push("verwenden Sie weniger Filter");
      }
      if (dataA["search-scope-0"].checked) {
        tips.push("erweitern Sie den Suchbereich");
      } else if (Object.values(dataA).filter(i => i).length > 1) {
        tips.push("schalten Sie erweiterte Suchoptionen aus");
      }
      tip = "Ändern Sie den Suchausdruck";
      if (tips.length) {
        tip = tips.join(" und ");
        tip = tip.substring(0, 1).toUpperCase() + tip.substring(1);
      }
      if (!Object.keys(xml.files).length) {
        tip = "Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden";
      }
      tip = `Tipp: ${tip}.`;
    } else if (!tip) {
      tip = "Tipp: Verwenden Sie weniger Filter.";
    }
    hint.innerHTML = tip;
    return div;
  },

  // make a heading for the list in XML and hints view
  //   file = string
  makeListHeading (file) {
    const icons = [
      {
        fun: "openPv",
        icon: "preview.svg",
        title: "Datei in der Vorschau öffnen",
      },
      {
        fun: "openLemmasPopup",
        icon: "lemmas.svg",
        title: "Lemmata des Artikels anzeigen",
      },
      {
        fun: "openEditor",
        icon: "xml.svg",
        title: "Datei im Editor öffnen",
      },
    ];

    const h1 = document.createElement("h1");
    h1.id = file;
    h1.textContent = file;

    // icons
    for (const icon of icons) {
      const a = document.createElement("a");
      h1.appendChild(a);
      a.classList.add("icon");
      a.dataset.fun = icon.fun;
      a.dataset.file = file;
      a.href = "#";
      a.title = icon.title;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        win[this.dataset.fun](this.dataset.file, this);
      });
      const img = document.createElement("img");
      a.appendChild(img);
      img.src = `img/win/${icon.icon}`;
      img.width = "30";
      img.height = "30";
      img.alt = "";
    }
    return h1;
  },

  // open preview
  //   file = string (XML file name)
  openPv (file) {
    const data = xml.data.files[file];
    if (!data) {
      shared.error(`Datei „${file}“ nicht mehr gefunden`);
      return;
    }
    modules.ipc.invoke("pv", {
      dir: data.dir,
      file,
      git: git.config.dir,
    });
  },

  // open file in editor
  //   file = string (XML file name)
  async openEditor (file) {
    const data = xml.data.files[file];
    if (!data) {
      shared.error(`Datei „${file}“ nicht mehr gefunden`);
      return;
    }
    const path = modules.path.join(git.config.dir, data.dir, file);
    const result = await modules.shell.openPath(path);
    if (result) {
      shared.error(result);
    }
  },

  // open a popup that shows all article lemmas
  //   file = string (XML file name)
  //   caller = node
  openLemmasPopup (file, caller) {
    caller.dispatchEvent(new Event("mouseout"));
    const content = document.createElement("div");
    const h2 = document.createElement("h2");
    content.appendChild(h2);
    h2.textContent = file;
    const data = xml.data.files[file];
    if (data.fa) {
      const h3 = document.createElement("h3");
      content.appendChild(h3);
      h3.textContent = "Wortfeld";
      printLemmas(content, data.faLemmas);
    } else {
      for (const type of [ "hl", "nl" ]) {
        const lemmas = data[type + "Joined"];
        if (!lemmas.length) {
          continue;
        }
        const h3 = document.createElement("h3");
        content.appendChild(h3);
        if (lemmas.length === 1) {
          h3.textContent = type === "hl" ? "Hauptlemma" : "Nebenlemma";
        } else {
          h3.textContent = type === "hl" ? "Hauptlemmata" : "Nebenlemmata";
        }
        printLemmas(content, lemmas);
      }
    }
    viewHints.popupShow(caller, content, "lemmas");

    // print lemma list
    function printLemmas (content, lemmas) {
      const p = document.createElement("p");
      content.appendChild(p);
      for (const l of lemmas) {
        if (p.hasChildNodes()) {
          p.appendChild(document.createElement("br"));
        }
        const lemma = shared.hidxPrint(l);
        p.appendChild(document.createTextNode(lemma));
      }
    }
  },

  // print a rotating icon
  pleaseWait () {
    const div = document.createElement("div");
    div.classList.add("wait");
    const img = document.createElement("img");
    div.appendChild(img);
    img.src = "img/win/loading.svg";
    img.width = "96";
    img.height = "96";
    img.alt = "";
    img.classList.add("rotate");
    return div;
  },

  // scroll pagewise
  //   down = boolean
  scroll (down) {
    const topBars = document.querySelector("#bar").getBoundingClientRect().bottom;
    const scroll = Math.round((window.innerHeight - topBars) * 0.85);
    let top = window.scrollY;
    if (down) {
      top += scroll;
    } else {
      top -= scroll;
    }
    window.scrollTo({
      top,
      left: 0,
      behavior: "smooth",
    });
  },

  // returns a hash that represents the current filter state of a view
  // (constructed on selected filters and sorting options)
  getFilterState () {
    const dataF = bars.filtersGetData();
    if (/xml|clusters/.test(win.view)) {
      for (const k of Object.keys(dataF)) {
        if (/^filters-(hints|marks)/.test(k)) {
          delete dataF[k];
        }
      }
    }
    if (win.view === "clusters") {
      delete dataF["select-status"];
    }
    const dataS = win.sortingGetData();
    const str = JSON.stringify(dataF) + JSON.stringify(dataS);
    return modules.crypto.createHash("sha1").update(str).digest("hex");
  },

  // sorting: toggle sorting icons
  //  a = node (icon link)
  sortingToggleIcons (a) {
    if (a.id === "sorting-dir") {
      const img = a.querySelector("img");
      if (/ascending/.test(img.getAttribute("src"))) {
        img.src = "img/win/sort-descending.svg";
        a.dataset.tooltip = "<i>Sortierung:</i> absteigend";
      } else {
        img.src = "img/win/sort-ascending.svg";
        a.dataset.tooltip = "<i>Sortierung:</i> aufsteigend";
      }
      tooltip.noTimeout = true;
      a.dispatchEvent(new Event("mouseover"));
    } else if (/sorting-(alpha|time)/.test(a.id)) {
      if (!a.classList.contains("active")) {
        for (const i of [ "alpha", "time" ]) {
          document.querySelector(`#sorting-${i}`).classList.toggle("active");
        }
      } else {
        return;
      }
    } else {
      a.classList.toggle("active");
    }
    win.viewPopulate();
  },

  // sorting: get current sorting data
  sortingGetData () {
    return {
      ascending: /ascending/.test(document.querySelector("#sorting-dir img").getAttribute("src")),
      filter: document.querySelector("#sorting-filter").value.trim(),
      ignore: document.querySelector("#sorting-ignore.active") !== null,
      type: document.querySelector("#sorting-alpha.active") ? "alpha" : "time",
    };
  },

  // sorting: apply sorting preferences
  //   dataS = object (sorting data)
  //   arr = array (to be sorted)
  sortingApply (dataS, arr) {
    const sortingDir = dataS.ascending ? [ -1, 1 ] : [ 1, -1 ];
    arr.sort((a, b) => {
      // folder "ignore" first
      if (dataS.ignore) {
        if (a.dir === "ignore" && b.dir === "articles") {
          return -1;
        } else if (a.dir === "articles" && b.dir === "ignore") {
          return 1;
        }
      }

      // alpha-numeric
      let x = a.file;
      let y = b.file;
      if (dataS.type === "time" &&
          a.published !== b.published) {
        x = a.published;
        y = b.published;
      }
      const result = shared.sort(x, y);
      if (result !== 0) {
        if (result === -1) {
          return sortingDir[0];
        }
        return sortingDir[1];
      }
      return result;
    });
  },

  // view: saves scroll position of view
  viewScrollTop: {},

  // view: reset the scroll position of the current view
  //   type = string (switched | updated)
  viewScrollTopReset (type) {
    if (type === "switched" && win.viewScrollTop[win.view]) {
      window.scrollTo(0, win.viewScrollTop[win.view]);
    } else if (!type) {
      window.scrollTo(0, 0);
    }
  },

  // view: determine the next view after pressing the keyboard shortcut
  //   toRight = boolean
  viewToggleShortcut (toRight) {
    const views = document.querySelectorAll("#view a");
    let idx = -1;
    for (let i = 0, len = views.length; i < len; i++) {
      if (views[i].classList.contains("active")) {
        idx = i;
        break;
      }
    }
    if (toRight) {
      idx++;
    } else {
      idx--;
    }
    if (idx < 0 || idx === views.length) {
      return;
    }
    views[idx].click();
  },

  // view: toggle views
  //   button = node
  async viewToggle (button) {
    // view is already active
    if (button.classList.contains("active")) {
      if (win.view === "search") {
        document.querySelector("#search-text").select();
      }
      return;
    }

    // block switching until the current switch was finished
    if (win.switching) {
      return;
    }
    win.switching = true;

    // close branch selector and popup in hints view
    git.branchSelectRemove();
    viewHints.popupClose({});

    // reset navigation index in hints view
    viewHints.navIdx = -1;

    // save scroll position
    win.viewScrollTop[win.view] = window.scrollY;

    // determine next view
    const nextView = button.id.replace("view-", "");

    // close results bar (if necessary)
    if (!/hints|search/.test(nextView) && document.querySelector("#results.visible")) {
      bars.toggle("results");
    }
    const sortingCont = document.querySelector("#sorting-filter-cont");
    if (nextView === "hints") {
      sortingCont.classList.add("hints-view");
    } else {
      sortingCont.classList.remove("hints-view");
    }

    // determine next bar content
    let activeBarContent = "";
    for (const i of document.querySelectorAll("#bar > div")) {
      if (!i.classList.contains("off")) {
        activeBarContent = i.id;
        break;
      }
    }
    let nextBarContent = "";
    switch (nextView) {
      case "xml":
        nextBarContent = "sorting";
        break;
      case "hints":
        nextBarContent = "sorting";
        break;
      case "clusters":
        nextBarContent = "clusters-nav";
        break;
      case "search":
        nextBarContent = "search-form";
        break;
    }

    // left or right
    const views = [ "xml", "hints", "clusters", "search" ];
    let direction = [ 1, -1 ];
    if (views.indexOf(nextView) > views.indexOf(win.view)) {
      direction = [ -1, 1 ];
    }

    // reduce advanced options if necessary
    await viewSearch.toggleAdvanced("off");

    // slide active bar content and <section>
    await new Promise(resolve => {
      const bc = document.getElementById(activeBarContent);
      const sect = document.getElementById(win.view);
      sect.addEventListener("transitionend", () => {
        for (const i of [ bc, sect ]) {
          i.classList.add("off");
          i.classList.remove("trans-linear");
        }
        resolve(true);
      }, { once: true });
      for (const i of [ bc, sect ]) {
        i.classList.add("trans-linear");
        i.style.left = "0px";
        void i.offsetWidth;
        i.style.left = direction[0] * window.innerWidth + "px";
      }
    });
    await shared.wait(25);

    // switch to next bar content and <section>
    const bc = document.getElementById(nextBarContent);
    const sect = document.getElementById(nextView);
    for (const i of [ bc, sect ]) {
      i.style.left = direction[1] * window.innerWidth + "px";
      i.classList.remove("off");
      void i.offsetWidth;
      i.style.left = "0px";
    }

    // switch buttons
    document.querySelectorAll("#view a").forEach(b => {
      if (b === button) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    // finish up
    win.view = nextView;
    bars.filtersToggleCat();
    bars.filtersActive();
    win.viewPopulate("switched");
    win.switching = false;
  },

  // view: populate the current view
  //   type = string | undefined
  viewPopulate (type = "") {
    switch (win.view) {
      case "xml":
        viewXml.populate(type);
        break;
      case "hints":
        viewHints.populate(type);
        break;
      case "clusters":
        viewClusters.update(type);
        break;
      case "search":
        win.viewScrollTopReset(type);
        bars.resultsSearch();
        document.querySelector("#search-text").select();
        break;
    }
  },
};

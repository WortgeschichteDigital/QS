"use strict";

const modules = {
  // Electron modules
  clipboard: require("electron").clipboard,
  ipc: require("electron").ipcRenderer,
  shell: require("electron").shell,

  // Node.js modules
  exec: require("child_process").exec,
  crypto: require("crypto"),
  fsp: require("fs").promises,
  path: require("path"),
}

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // KEYBOARD EVENTS
  document.addEventListener("keydown", keyboard.shortcuts);
  let sortingFilterTimeout;
  document.querySelector("#sorting-filter").addEventListener("input", () => {
    clearTimeout(sortingFilterTimeout);
    sortingFilterTimeout = setTimeout(() => win.viewPopulate(), 250);
  });

  // WINDOW EVENTS
  let winEventsTimeout;
  window.addEventListener("resize", () => {
    viewHints.navIdx = -1;
    clearTimeout(winEventsTimeout);
    winEventsTimeout = setTimeout(() => {
      tooltip.off();
    }, 25);
  });
  window.addEventListener("scroll", () => {
    viewHints.navIdx = -1;
    clearTimeout(winEventsTimeout);
    winEventsTimeout = setTimeout(() => {
      tooltip.off();
    }, 25);
  });

  // CLUSTERS
  document.querySelectorAll(".clusters-view").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      viewClusters.switchSection(this);
    });
  });
  const clustersSearch = document.querySelector("#clusters-modulate-search");
  let clustersSearchTimeout;
  clustersSearch.addEventListener("input", () => {
    clearTimeout(clustersSearchTimeout);
    clustersSearchTimeout = setTimeout(() => clustersMod.search(), 200);
  });
  clustersSearch.addEventListener("keydown", function (evt) {
    const m = shared.detectKeyboardModifiers(evt);
    if (!m && evt.key === "Escape") {
      clustersMod.searchOff();
    } else if (!m && evt.key === "Enter") {
      const popup = document.querySelector("#clusters-modulate-popup");
      if (!popup) {
        return;
      }
      const active = popup.querySelector(".active");
      if (active) {
        active.click();
      } else {
        popup.querySelector("a").click();
      }
      this.select();
    }
  });
  clustersSearch.addEventListener("focus", () => clustersMod.search());
  clustersSearch.addEventListener("blur", () => {
    clearTimeout(clustersSearchTimeout);
    clustersSearchTimeout = setTimeout(() => clustersMod.searchOff(), 200);
  });
  document.querySelector("#clusters-modulate-reset").addEventListener("click", evt => {
    evt.preventDefault();
    clustersMod.reset();
  });
  document.querySelector("#clusters-nav-preview").addEventListener("click", evt => {
    evt.preventDefault();
    viewClusters.previewSwitch();
  });
  document.querySelector("#clusters-preview a").addEventListener("click", evt => {
    evt.preventDefault();
    viewClusters.previewPopupOff();
  });
  document.querySelectorAll('#clusters-preview input[type="radio"]').forEach(i => {
    i.addEventListener("change", () => viewClusters.previewPopupState());
  });
  document.querySelector("#clusters-preview-choose").addEventListener("click", () => viewClusters.previewChoose());
  document.querySelector("#clusters-nav-new").addEventListener("click", function (evt) {
    evt.preventDefault();
    this.dispatchEvent(new Event("mouseout"));
    clustersCheck.jump();
  });

  // SEARCH
  document.querySelector("#search-advanced-toggle").addEventListener("click", evt => {
    evt.preventDefault();
    viewSearch.toggleAdvanced();
  });
  document.querySelectorAll("#hints-bar, #search-bar").forEach(i => {
    i.addEventListener("click", evt => {
      evt.preventDefault();
      bars.toggle("results");
    });
  });
  document.querySelectorAll("#search-advanced input").forEach(i => {
    i.addEventListener("change", () => viewSearch.toggleAdvancedIcon());
  });
  document.querySelector("#search-start").addEventListener("click", () => viewSearch.start());
  document.querySelectorAll("#search-scope input").forEach(i => {
    i.addEventListener("change", function () {
      viewSearch.toggleScope(this);
    });
  });

  // CLICK EVENTS
  document.querySelectorAll(".clear-text-field").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      win.clearTextField(this);
    });
  });
  document.querySelectorAll("#sorting a.icon").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      win.sortingToggleIcons(this);
    });
  });
  document.querySelectorAll(".select-filter").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      if (this.parentNode.querySelector(".select-popup")) {
        bars.selectPopupClose(this, false);
      } else {
        bars.selectPopup(this);
      }
    });
    i.addEventListener("blur", function () {
      const activeSelect = this.closest(".select-cont:focus-within");
      if (!activeSelect) {
        bars.selectPopupClose(this, true);
      }
    });
  });
  document.querySelector("#filters-reset").addEventListener("click", evt => {
    evt.preventDefault();
    bars.filtersReset();
  });
  document.querySelectorAll("#filters-hints-all, #filters-hints-none").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      bars.filtersToggleHints(this.id);
    });
  });
  document.querySelectorAll("#filters input").forEach(i => {
    i.addEventListener("change", () => {
      bars.filtersActive();
      win.viewPopulate();
    });
  });

  // CLICK EVENTS: HEADER
  document.querySelectorAll("#view a").forEach(a => {
    a.addEventListener("click", function (evt) {
      evt.preventDefault();
      win.viewToggle(this);
    });
  });
  document.querySelector("#fun-filters").addEventListener("click", evt => {
    evt.preventDefault();
    bars.toggle("filters");
  });
  document.querySelector("#fun-update").addEventListener("click", evt => {
    evt.preventDefault();
    xml.update();
  });
  document.querySelectorAll("#fun-git a").forEach(a => {
    a.addEventListener("click", function (evt) {
      evt.preventDefault();
      git.command(this);
    });
  });

  // CLICK EVENTS: OVERLAYS
  document.querySelectorAll(".overlay").forEach(i => {
    i.addEventListener("click", function () {
      this.querySelector(".overlay-close")?.click();
    });
  });
  document.querySelectorAll(".overlay > div").forEach(i => {
    i.addEventListener("click", evt => evt.stopPropagation());
  });
  document.querySelectorAll(".overlay-close").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      overlay.close(this);
    });
  });
  document.querySelector("#error-open").addEventListener("click", evt => {
    evt.preventDefault();
    error.openLog();
  });
  document.querySelector("#error-delete").addEventListener("click", evt => {
    evt.preventDefault();
    error.deleteLog();
  });
  document.querySelector("#git-dir-open").addEventListener("click", evt => {
    evt.preventDefault();
    git.dirSelect();
  });
  document.querySelector("#git-okay").addEventListener("click", () => git.configFormCheck());
  document.querySelectorAll("#prefs li a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      prefs.changeSection(this);
    });
  });
  document.querySelector("#prefs-zeitstrahl-open").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zeitstrahlOpen();
  });
  document.querySelector("#prefs-zeitstrahl-remove").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zeitstrahlRemove();
  });
  document.querySelector("#prefs-zdl-open").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zdlOpen();
  });
  document.querySelector("#prefs-zdl-remove").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zdlRemove();
  });
  document.querySelector("#prefs-data-export").addEventListener("click", () => prefs.exportData());
  document.querySelector("#prefs-data-import").addEventListener("click", () => prefs.importData());
  document.querySelector("#prefs-marks").addEventListener("click", () => viewHints.eraseMarks());
  document.querySelector("#prefs-cache-leeren").addEventListener("click", () => xml.resetCache(true));
  document.querySelector("#prefs-git-config").addEventListener("click", () => prefs.gitConfig());
  document.querySelectorAll("#dialog input").forEach(i => {
    i.addEventListener("click", function () {
      dialog.response = this.dataset.response === "true";
    });
  });
  document.querySelectorAll("#tags-nav a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      tags.showSummaryNav(this.dataset.forward === "true");
    });
  });
  document.querySelector("#tags-show-teaser").addEventListener("click", function (evt) {
    evt.preventDefault();
    viewXml.funTeaser(this.parentNode.dataset.file);
  });
  document.querySelector("#tags-open-file").addEventListener("click", function (evt) {
    evt.preventDefault();
    win.openEditor(this.parentNode.dataset.file);
  });
  document.querySelector("#artikel-zeitstrahl a").addEventListener("click", evt => {
    evt.preventDefault();
    artikel.appendZeitstrahl();
  });
  document.querySelector("#artikel-branch a").addEventListener("click", evt => {
    evt.preventDefault();
    artikel.changeBranch();
  });
  document.querySelector("#artikel-calculate").addEventListener("click", () => {
    artikel.calculate({
      cli: false,
      noNew: true,
    });
  });
  document.querySelector("#overview-branch a").addEventListener("click", evt => {
    evt.preventDefault();
    overview.changeBranch();
  });
  document.querySelector("#overview-calculate").addEventListener("click", () => overview.calculate(true, false));
  document.querySelector("#term-export").addEventListener("click", () => term.exportFile());
  document.querySelector("#svg-load").addEventListener("click", () => svg.load());
  document.querySelector("#svg-transform").addEventListener("click", () => svg.transform());

  // LISTEN TO IPC MESSAGES
  modules.ipc.on("menu-app-updates", () => win.menuCommand("app-updates"));
  modules.ipc.on("menu-artikel-json", () => win.menuCommand("artikel-json"));
  modules.ipc.on("menu-clusters", () => win.menuCommand("clusters"));
  modules.ipc.on("menu-error-log", () => win.menuCommand("error-log"));
  modules.ipc.on("menu-filters", () => win.menuCommand("filters"));
  modules.ipc.on("menu-hints", () => win.menuCommand("hints"));
  modules.ipc.on("menu-overview", () => win.menuCommand("overview"));
  modules.ipc.on("menu-preferences", () => win.menuCommand("preferences"));
  modules.ipc.on("menu-search", () => win.menuCommand("search"));
  modules.ipc.on("menu-svg", () => win.menuCommand("svg"));
  modules.ipc.on("menu-teaser-tags", () => win.menuCommand("teaser-tags"));
  modules.ipc.on("menu-term", () => win.menuCommand("term"));
  modules.ipc.on("menu-update", () => win.menuCommand("update"));
  modules.ipc.on("menu-xml", () => win.menuCommand("xml"));
  modules.ipc.on("cli-command", (evt, command) => cli.distribute(command));
  modules.ipc.on("save-prefs", () => prefs.save());
  modules.ipc.on("update-file", (evt, xmlFiles) => xml.update(xmlFiles));

  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // PRELOAD IMAGES
  const images = await modules.ipc.invoke("list-of-images");
  const imagesPreload = [];
  for (const i of images) {
    const img = new Image();
    img.src = "img/win/" + i;
    imagesPreload.push(img);
  }

  // INITIALIZE APP
  shared.keyboardMacOS();
  tooltip.addLongHelp();
  tooltip.init();
  document.querySelector("#bar").style.height = "60px";
  await prefs.init(false);
  viewSearch.toggleAdvancedIcon();
  await git.configCheck();
  await xml.update();
  prefs.data["app-version"] = shared.info.version;
  document.querySelectorAll(".select-filter").forEach(i => bars.selectFill(i));
  bars.filtersActive();
  document.body.classList.add("scrollable");
  overlay.hide("loading");
  win.ready = true;

  // SEARCH FOR UPDATES
  const [ today ] = new Date().toISOString().split("T");
  if (today !== prefs.data.updateCheck) {
    updates.timeout = setTimeout(() => updates.check(true), 15e3);
  }
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));

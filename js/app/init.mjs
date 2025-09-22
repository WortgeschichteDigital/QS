
import artikel from "./artikel.mjs";
import bars from "./bars.mjs";
import cli from "./cli.mjs";
import clustersCheck from "./clustersCheck.mjs";
import clustersMod from "./clustersMod.mjs";
import error from "./error.mjs";
import git from "./git.mjs";
import keyboard from "./keyboard.mjs";
import misc from "./misc.mjs";
import overview from "./overview.mjs";
import prefs from "./prefs.mjs";
import svg from "./svg.mjs";
import tags from "./tags.mjs";
import term from "./term.mjs";
import updates from "./updates.mjs";
import viewClusters from "./viewClusters.mjs";
import viewHints from "./viewHints.mjs";
import viewSearch from "./viewSearch.mjs";
import viewXml from "./viewXml.mjs";
import xml from "./xml.mjs";

import dialog from "../dialog.mjs";
import overlay from "../overlay.mjs";
import popup from "../popup.mjs";
import shared from "../shared.mjs";
import tooltip from "../tooltip.mjs";

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // KEYBOARD EVENTS
  document.addEventListener("keydown", keyboard.shortcuts);
  let sortingFilterTimeout;
  document.getElementById("sorting-filter").addEventListener("input", () => {
    clearTimeout(sortingFilterTimeout);
    sortingFilterTimeout = setTimeout(() => misc.viewPopulate(), 250);
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
  const clustersSearch = document.getElementById("clusters-modulate-search");
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
      const popup = document.getElementById("clusters-modulate-popup");
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
  document.getElementById("clusters-modulate-reset").addEventListener("click", evt => {
    evt.preventDefault();
    clustersMod.reset();
  });
  document.getElementById("clusters-nav-preview").addEventListener("click", evt => {
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
  document.getElementById("clusters-preview-choose").addEventListener("click", () => viewClusters.previewChoose());
  document.getElementById("clusters-nav-new").addEventListener("click", function (evt) {
    evt.preventDefault();
    this.dispatchEvent(new Event("mouseout"));
    clustersCheck.jump();
  });

  // SEARCH
  document.getElementById("search-advanced-toggle").addEventListener("click", evt => {
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
  document.getElementById("search-start").addEventListener("click", () => viewSearch.start());
  document.querySelectorAll("#search-scope input").forEach(i => {
    i.addEventListener("change", function () {
      viewSearch.toggleScope(this);
    });
  });

  // CLICK EVENTS
  document.querySelectorAll(".clear-text-field").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      misc.clearTextField(this);
    });
  });
  document.querySelectorAll("#sorting a.icon").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      if (i.id === "hint-export") {
        viewHints.exportHints();
      } else {
        misc.sortingToggleIcons(this);
      }
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
  document.getElementById("filters-reset").addEventListener("click", evt => {
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
      misc.viewPopulate();
    });
  });

  // CLICK EVENTS: HEADER
  document.querySelectorAll("#view a").forEach(a => {
    a.addEventListener("click", function (evt) {
      evt.preventDefault();
      misc.viewToggle(this);
    });
  });
  document.getElementById("fun-filters").addEventListener("click", evt => {
    evt.preventDefault();
    bars.toggle("filters");
  });
  document.getElementById("fun-update").addEventListener("click", evt => {
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
  document.getElementById("error-open").addEventListener("click", evt => {
    evt.preventDefault();
    error.openLog();
  });
  document.getElementById("error-delete").addEventListener("click", evt => {
    evt.preventDefault();
    error.deleteLog();
  });
  document.getElementById("git-dir-open").addEventListener("click", evt => {
    evt.preventDefault();
    git.dirSelect();
  });
  document.getElementById("git-okay").addEventListener("click", () => git.configFormCheck());
  document.querySelectorAll("#prefs li a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      prefs.changeSection(this);
    });
  });
  document.getElementById("prefs-zeitstrahl-open").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zeitstrahlOpen();
  });
  document.getElementById("prefs-zeitstrahl-remove").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zeitstrahlRemove();
  });
  document.getElementById("prefs-ressourcen-open").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.ressourcenOpen();
  });
  document.getElementById("prefs-ressourcen-remove").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.ressourcenRemove();
  });
  document.getElementById("prefs-zdl-open").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zdlOpen();
  });
  document.getElementById("prefs-zdl-remove").addEventListener("click", evt => {
    evt.preventDefault();
    prefs.zdlRemove();
  });
  document.getElementById("prefs-data-export").addEventListener("click", () => prefs.exportData());
  document.getElementById("prefs-data-import").addEventListener("click", () => prefs.importData());
  document.getElementById("prefs-marks").addEventListener("click", () => viewHints.eraseMarks());
  document.getElementById("prefs-cache-leeren").addEventListener("click", () => xml.resetCache(true));
  document.getElementById("prefs-html-cache-leeren").addEventListener("click", () => prefs.clearHTMLCache());
  document.getElementById("prefs-git-config").addEventListener("click", () => prefs.gitConfig());
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
  document.getElementById("tags-show-teaser").addEventListener("click", function (evt) {
    evt.preventDefault();
    viewXml.funTeaser(this.parentNode.dataset.file);
  });
  document.getElementById("tags-open-file").addEventListener("click", function (evt) {
    evt.preventDefault();
    misc.openEditor(this.parentNode.dataset.file);
  });
  document.querySelectorAll(":is(#artikel-zeitstrahl, #artikel-ressourcen) a").forEach(i => {
    i.addEventListener("click", evt => {
      evt.preventDefault();
      artikel.appendData();
    });
  });
  document.querySelector("#artikel-branch a").addEventListener("click", evt => {
    evt.preventDefault();
    artikel.changeBranch();
  });
  document.getElementById("artikel-calculate").addEventListener("click", () => {
    artikel.calculate({
      cli: false,
      noNew: true,
    });
  });
  document.querySelector("#overview-branch a").addEventListener("click", evt => {
    evt.preventDefault();
    overview.changeBranch();
  });
  document.getElementById("overview-calculate").addEventListener("click", () => overview.calculate(true, false));
  document.getElementById("term-export").addEventListener("click", () => term.exportFile());
  document.getElementById("svg-load").addEventListener("click", () => svg.load());
  document.getElementById("svg-transform").addEventListener("click", () => svg.transform());

  // LISTEN TO IPC MESSAGES
  bridge.ipc.listen("cli-command", command => cli.distribute(command));
  bridge.ipc.listen("copy-link", () => popup.copyLink());
  bridge.ipc.listen("filters-reset", () => document.getElementById("filters-reset").click());
  bridge.ipc.listen("menu-app-updates", () => misc.menuCommand("app-updates"));
  bridge.ipc.listen("menu-artikel-json", () => misc.menuCommand("artikel-json"));
  bridge.ipc.listen("menu-clusters", () => misc.menuCommand("clusters"));
  bridge.ipc.listen("menu-error-log", () => misc.menuCommand("error-log"));
  bridge.ipc.listen("menu-filters", () => misc.menuCommand("filters"));
  bridge.ipc.listen("menu-hints", () => misc.menuCommand("hints"));
  bridge.ipc.listen("menu-overview", () => misc.menuCommand("overview"));
  bridge.ipc.listen("menu-preferences", () => misc.menuCommand("preferences"));
  bridge.ipc.listen("menu-search", () => misc.menuCommand("search"));
  bridge.ipc.listen("menu-svg", () => misc.menuCommand("svg"));
  bridge.ipc.listen("menu-teaser-tags", () => misc.menuCommand("teaser-tags"));
  bridge.ipc.listen("menu-term", () => misc.menuCommand("term"));
  bridge.ipc.listen("menu-update", () => misc.menuCommand("update"));
  bridge.ipc.listen("menu-xml", () => misc.menuCommand("xml"));
  bridge.ipc.listen("results", () => bars.toggle("results"));
  bridge.ipc.listen("save-prefs", () => prefs.save());
  bridge.ipc.listen("update-file", xmlFiles => xml.update(xmlFiles));

  // GET APP INFO
  shared.info = await bridge.ipc.invoke("app-info");

  // PRELOAD IMAGES
  const images = await bridge.ipc.invoke("list-of-images");
  const imagesPreload = [];
  for (const i of images) {
    if (!/\.svg$/.test(i)) {
      continue;
    }
    const img = new Image();
    img.src = "img/" + i;
    imagesPreload.push(img);
  }

  // INITIALIZE APP
  shared.keyboardMacOS();
  tooltip.addLongHelp();
  tooltip.init();
  document.getElementById("bar").style.height = "60px";
  await prefs.init(false);
  viewSearch.toggleAdvancedIcon();
  await git.configCheck();
  await xml.update();
  prefs.data["app-version"] = shared.info.version;
  document.querySelectorAll(".select-filter").forEach(i => bars.selectFill(i));
  bars.filtersActive();
  document.body.classList.add("scrollable");
  overlay.hide("loading");
  misc.ready = true;
  popup.misc = misc;

  // SEARCH FOR UPDATES
  const [ today ] = new Date().toISOString().split("T");
  if (today !== prefs.data.updateCheck) {
    updates.timeout = setTimeout(() => updates.check(true), 15e3);
  }
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));

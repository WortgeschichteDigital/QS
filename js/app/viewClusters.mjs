
import bars from "./bars.mjs";
import clustersCheck from "./clustersCheck.mjs";
import clustersComp from "./clustersComp.mjs";
import clustersMod from "./clustersMod.mjs";
import git from "./git.mjs";
import misc from "./misc.mjs";
import prefs from "./prefs.mjs";
import xml from "./xml.mjs";

import shared from "../shared.mjs";

export { viewClusters as default };

const viewClusters = {
  // last content state of this view
  contentState: {
    // hash
    filterState: "",
    // date of last XML update
    xmlDate: "",
  },

  // clusters' data
  // structure of the cluster objects ("repo" and "preview"):
  //   [DOMAIN]     = array
  //     [CIRCLE]   = object (circles: "z" for Zentrum, "s" for Saum, "u" for Umfeld)
  //       [LEMMA]  = object (joined spelling as in "hlJoined" and "nlJoined" in xml.data.files)
  //         file   = string (XML file name)
  //         points = integer
  // the lemmas in there circle are sorted by weight or alphabet respectively
  data: {
    active: "repo",
    // indices of clusters to show in the sections "compare" and "check"
    idx: [],
    // clusters as they appear in the file Artikel.json (lemmas in written form)
    repo: {},
    // newly calculated clusters (lemmas in written form)
    preview: {},
    // calculation in progress
    previewCalculating: false,
    // date the preview was calculated
    previewDate: null,
    // contains a date object that saves the time when the calculation started
    previewStatsStart: null,
  },

  // currently active filters
  filters: {},

  // saves the sections' scroll position
  scrollPos: {},

  // worker that calculates the preview
  worker: null,

  // update the view
  //   type = string (switched | updated)
  async update (type) {
    // get current content state
    // (restore scroll position in case the state is unchanged)
    const filterState = await misc.getFilterState();
    if (filterState === viewClusters.contentState.filterState &&
        xml.data.date === viewClusters.contentState.xmlDate) {
      misc.viewScrollTopReset(type);
      viewClusters.focusSearchField();
      return;
    }
    viewClusters.contentState.filterState = filterState;
    viewClusters.contentState.xmlDate = xml.data.date;
    if (filterState === viewClusters.contentState.filterState) {
      misc.viewScrollTopReset(type);
    } else {
      window.scrollTo(0, 0);
    }

    // load Artikel.json from repository
    if (!Object.keys(viewClusters.data.repo).length) {
      await viewClusters.loadArtikelJSON();
    }

    // update filters in top bar
    viewClusters.filters = bars.filtersGetData();
    const filters = document.getElementById("clusters-nav-filters");
    const filtersText = [];
    if (viewClusters.filters["select-authors"]) {
      let author = "";
      for (const i of viewClusters.filters["select-authors"].split(/[\s-]/)) {
        author += i.substring(0, 1);
      }
      filtersText.push(author);
    }
    if (viewClusters.filters["select-domains"]) {
      filtersText.push(viewClusters.filters["select-domains"]);
    }
    if (filtersText.length) {
      filters.classList.remove("no-filters");
      filters.textContent = filtersText.join(" | ");
    } else {
      filters.classList.add("no-filters");
      filters.textContent = "keine Filter";
    }

    // collect indices of relevant clusters,
    // check filters,
    // update the section views
    await viewClusters.updateCompCheck(false);
    for (const val of Object.values(clustersMod.data.files)) {
      val.clear();
    }
    clustersMod.update();

    // focus search field in the modelling section
    viewClusters.focusSearchField();
  },

  // update the section views "compare" and "check"
  // (also collects indices of relevant cllusters and checks the filters)
  //   previewToggle = boolean
  async updateCompCheck (previewToggle) {
    const result = viewClusters.checkFilters();
    if (result.ok) {
      // okay => build view
      const { scrollY } = window;
      await clustersCheck.build();
      clustersComp.build();
      if (previewToggle &&
          !document.querySelector("#clusters-comp.off")) {
        // retain scroll position in "compare"
        // when the preview has been toggled
        window.scrollTo(0, scrollY);
      }
    } else {
      // not okay => print message
      for (const i of [ "compare", "check" ]) {
        const sect = document.getElementById(`clusters-${i}`);
        sect.replaceChildren();
        sect.appendChild(result.message.cloneNode(true));
      }
      // deactivate jump icon in comparison section
      document.getElementById("clusters-nav-new").classList.remove("active");
    }
  },

  // focus search field in the modelling section
  focusSearchField () {
    if (!document.querySelector("#clusters-model.off")) {
      document.getElementById("clusters-model-search").select();
    }
  },

  // switch cluster sections
  //   icon = node
  switchSection (icon) {
    // no need to switch the section
    if (icon.classList.contains("active")) {
      return;
    }

    // switch section
    let oldSection = "";
    const newSection = icon.id.replace(/.+-/, "");
    const id = "clusters-" + newSection;

    // memorize current scroll position
    const { scrollY } = window;
    document.querySelectorAll("#clusters > div:not(#clusters-preview)").forEach(i => {
      if (!i.classList.contains("off")) {
        oldSection = i.id.replace(/.+-/, "");
        viewClusters.scrollPos[oldSection] = scrollY;
      }
      if (i.id === id) {
        i.classList.remove("off");
      } else {
        i.classList.add("off");
      }
    });

    // switch active icon
    document.querySelector(".clusters-view.active").classList.remove("active");
    icon.classList.add("active");

    // reset scroll position
    if (typeof viewClusters.scrollPos[newSection] !== "undefined") {
      window.scrollTo(0, viewClusters.scrollPos[newSection]);
    } else {
      window.scrollTo(0, 0);
    }

    // update add images in comparison section
    if (newSection === "compare" &&
        oldSection === "model") {
      clustersComp.adaptToModel();
    }

    // toggle visibility of jump icon
    const jump = document.getElementById("clusters-nav-new");
    if (newSection === "check") {
      jump.classList.remove("off");
    } else {
      jump.classList.add("off");
    }

    // focus search field in modelling section
    viewClusters.focusSearchField();
  },

  // collect indices of relevant clusters and check filters:
  //   - Is a domain selected?
  //   - Are there any clusters for this domain?
  //   - Are there any clusters for the selected author?
  checkFilters () {
    const { filters } = viewClusters;
    const { data } = viewClusters;
    let error = "";
    data.idx.length = 0;
    if (!filters["select-domains"]) {
      error = "Für diese Funktion müssen Sie ein Themenfeld einstellen.";
    } else if (!data[data.active][filters["select-domains"]]?.length) {
      error = `Zum Themenfeld <i>${filters["select-domains"]}</i> gibt es noch keine Cluster.`;
    } else if (filters["select-authors"]) {
      let clusterFound = false;
      for (let i = 0, len = data[data.active][filters["select-domains"]].length; i < len; i++) {
        const cluster = data[data.active][filters["select-domains"]][i];
        for (const values of Object.values(cluster.z)) {
          if (xml.data.files[values.file].authors.includes(filters["select-authors"])) {
            clusterFound = true;
            data.idx.push(i);
            break;
          }
        }
      }
      if (!clusterFound) {
        error = `Keine Cluster von <i>${filters["select-authors"]}</i> gefunden.`;
      }
    } else {
      for (let i = 0, len = data[data.active][filters["select-domains"]].length; i < len; i++) {
        data.idx.push(i);
      }
    }
    if (error) {
      return {
        ok: false,
        message: misc.nothingToShow("Filter anpassen!", error),
      };
    }
    return {
      ok: true,
    };
  },

  // check whether the files of a cluster still exist
  // (after an update some XML files might not be present anymore)
  //   clusters = array
  checkFiles (clusters) {
    for (const cluster of clusters) {
      for (const circle of [ "z", "s", "u" ]) {
        for (const values of Object.values(cluster[circle])) {
          if (!xml.data.files[values.file]) {
            return misc.nothingToShow("Cluster auffrischen!", "In der aktuellen Berechnung befinden sich Dateien, die mittlerweile gelöscht wurden.");
          }
        }
      }
    }
    return false;
  },

  // load the file Artikel.json from the repo
  async loadArtikelJSON () {
    // load file
    const path = await bridge.ipc.invoke("path-join", git.config.dir, "resources", "Artikel.json");
    const content = await bridge.ipc.invoke("file-read", path);
    if (typeof content !== "string") {
      shared.error(`${content.name}: ${content.message} (${shared.errorReduceStack(content.stack)})`);
      return;
    }

    // parse data
    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      return;
    }

    // extract clusters
    const { repo } = viewClusters.data;
    const fileCache = {};
    for (const [ domain, clusters ] of Object.entries(data.clusters)) {
      repo[domain] = [];
      for (const cluster of clusters) {
        const cl = {
          z: {},
          s: {},
          u: {},
        };
        repo[domain].push(cl);
        for (const circle of [ "z", "s", "u" ]) {
          for (const [ lemma, points ] of Object.entries(cluster[circle])) {
            const spelling = data.values.le[lemma.substring(1)];
            if (fileCache[spelling]) {
              cl[circle][spelling] = {
                file: fileCache[spelling],
                points,
              };
            } else {
              for (const [ file, values ] of Object.entries(xml.data.files)) {
                if (values.hlJoined.includes(spelling) ||
                    values.nlJoined.includes(spelling)) {
                  cl[circle][spelling] = {
                    file,
                    points,
                  };
                  fileCache[spelling] = file;
                  break;
                }
              }
            }
          }
        }
      }
    }
  },

  // build a cluster
  //   idx = number
  //   checkModel = true | undefined (check whether a lemma was added to "modelling")
  //   markLemma = string | undefined (lemma to be marked)
  buildCluster ({ idx, checkModel = false, markLemma = "" }) {
    const { data } = viewClusters;
    const cluster = data[data.active][viewClusters.filters["select-domains"]][idx];
    const cont = document.createElement("div");
    cont.classList.add("cluster");

    // Are there any dominant lemmas?
    const weights = [];
    for (const i of Object.values(cluster.z)) {
      weights.push(i.points);
    }
    let dominanceThreshold = Math.ceil(weights[0] / 10);
    if (dominanceThreshold < 3) {
      dominanceThreshold = 3;
    }
    let dominanceArtExist = false;
    for (let j = 1, len = weights.length; j < len; j++) {
      if (weights[j] <= weights[0] - dominanceThreshold &&
          weights[0] - weights[j] >= 3) {
        dominanceArtExist = true;
        break;
      }
    }

    // periphery
    let periphery;
    if (Object.keys(cluster.u).length) {
      periphery = document.createElement("div");
      cont.appendChild(periphery);
      periphery.classList.add("cluster-periphery", "cluster-circle");
    }

    // fringe
    let fringe;
    if (Object.keys(cluster.s).length) {
      fringe = document.createElement("div");
      if (periphery) {
        periphery.appendChild(fringe);
      } else {
        cont.appendChild(fringe);
      }
      fringe.classList.add("cluster-fringe", "cluster-circle");
    }

    // center
    const center = document.createElement("div");
    if (fringe) {
      fringe.appendChild(center);
    } else if (periphery) {
      periphery.appendChild(center);
    } else {
      cont.appendChild(center);
    }
    center.classList.add("cluster-center", "cluster-circle");

    // fill in lemmas
    const circles = [
      {
        key: "z",
        cont: center,
      },
      {
        key: "s",
        cont: fringe,
      },
      {
        key: "u",
        cont: periphery,
      },
    ];
    for (const circle of circles) {
      const dominant = document.createElement("div");
      dominant.classList.add("cluster-dominant");
      const recessive = document.createElement("div");
      recessive.classList.add("cluster-recessive");
      for (let [ lemma, values ] of Object.entries(cluster[circle.key])) {
        let cont = recessive;
        if (circle.key === "z" &&
              dominanceArtExist &&
              values.points > weights[0] - dominanceThreshold ||
            circle.key === "s" &&
              values.points > 1e3) {
          cont = dominant;
        }
        // lemma
        const span = document.createElement("span");
        cont.appendChild(span);
        span.dataset.lemma = lemma;
        // lemma was added to "modelling"
        if (checkModel &&
            clustersMod.data.center[lemma]) {
          span.classList.add("in-modelling");
        }
        // mark lemma
        if (lemma === markLemma) {
          span.classList.add("marked");
        }
        if (xml.data.files[values.file].fa) {
          span.classList.add("fa");
          span.title = "Wortfeldartikel";
        } else if (xml.data.files[values.file].nlJoined.includes(lemma)) {
          span.title = "Nebenlemma";
        }
        lemma = shared.hidxPrint(lemma);
        if (lemma.length > 30 &&
            /\//.test(lemma)) {
          span.classList.add("wrap");
          lemma = lemma.replace(/\//g, "/<wbr>");
        }
        span.innerHTML = lemma;
      }
      if (dominant && dominant.hasChildNodes()) {
        circle.cont.appendChild(dominant);
      }
      if (recessive && recessive.hasChildNodes()) {
        circle.cont.appendChild(recessive);
      }
    }
    return cont;
  },

  // mark or unmark a lemma
  //   lemma = string
  //   mark = boolean
  //   section = object
  //   sectionName = string
  // (this method is used by clustersComp and clustersCheck)
  markLemma ({ lemma, mark, section, sectionName }) {
    document.querySelectorAll(`#clusters-${sectionName} .marked`).forEach(i => i.classList.remove("marked"));
    if (mark) {
      document.querySelectorAll(`#clusters-${sectionName} span`).forEach(i => {
        if (i.dataset.lemma === lemma) {
          i.classList.add("marked");
        }
      });
      section.marked = lemma;
    } else {
      section.marked = "";
    }
  },

  // preview: switch to or from clusters preview respectively
  async previewSwitch () {
    const { data } = viewClusters;

    // turn preview off
    if (data.active === "preview") {
      if (viewClusters.data.previewCalculating) {
        viewClusters.worker.terminate();
        viewClusters.worker = null;
        shared.feedback("error");
        viewClusters.data.previewCalculating = false;
      }
      data.active = "repo";
      viewClusters.previewButtonUpdate();
      viewClusters.previewIconState("done");
      viewClusters.updateCompCheck(true);
      return;
    }

    // show preview configuration window
    await xml.updateWait();
    const oldPreview = document.getElementById("clusters-preview-choose-old");
    const newPreview = document.getElementById("clusters-preview-choose-new");
    if (data.previewDate) {
      const pd = data.previewDate;
      const pdText = `von ${pd.getHours()}:${pd.getMinutes().toString().padStart(2, "0")} Uhr `;
      oldPreview.nextSibling.querySelector("span").textContent = pdText;
      oldPreview.disabled = false;
    } else {
      oldPreview.disabled = true;
    }
    if (oldPreview.disabled) {
      oldPreview.checked = false;
      newPreview.checked = true;
    } else {
      oldPreview.checked = true;
      newPreview.checked = false;
    }
    const mod = document.getElementById("clusters-preview-model-check");
    if (document.querySelector("#clusters-model-files .proposals a")) {
      mod.checked = true;
    } else {
      mod.checked = false;
    }
    viewClusters.previewPopupState();
    const popup = document.getElementById("clusters-preview");
    popup.classList.remove("off");
    void popup.offsetWidth;
    popup.classList.add("visible");
    document.getElementById("clusters-preview-choose").focus();
  },

  // preview: choose what to do after a click on the button in the popup
  previewChoose () {
    viewClusters.previewPopupOff();
    viewClusters.data.active = "preview";
    viewClusters.previewButtonUpdate();
    if (document.getElementById("clusters-preview-choose-old").checked) {
      viewClusters.updateCompCheck(true);
      return;
    }
    viewClusters.previewCalculate();
  },

  // preview: start calculation
  previewCalculate () {
    viewClusters.data.previewCalculating = true;

    // animate icon
    viewClusters.previewIconState("working");

    // load worker if necessary
    if (!viewClusters.worker) {
      viewClusters.worker = new Worker("js/app/workerClusters.mjs", {
        type: "module",
      });
      viewClusters.worker.addEventListener("message", async evt => {
        const { data } = viewClusters;
        data.preview = evt.data;
        data.previewDate = new Date();
        prefs.stats("clusters", data.previewStatsStart);
        viewClusters.previewIconState("done");
        await viewClusters.updateCompCheck(true);
        shared.feedback("okay");
        data.previewCalculating = false;
      });
    }

    // prepare data
    viewClusters.data.previewStatsStart = new Date();
    const removeTypeCluster = document.querySelector("#clusters-preview-no-type-cluster:checked") !== null;
    const addModelling = document.getElementById("clusters-preview-model-check").checked;
    const workerData = viewClusters.gleanWorkerData({
      addModelling,
      noNewFiles: false,
      removeTypeCluster,
    });

    // start the calculation
    viewClusters.worker.postMessage({
      domains: workerData.domains,
      files: workerData.files,
    });
  },

  // preview: change state of preview icon
  //   state = string (working | done)
  previewIconState (state) {
    const icon = document.querySelector("#clusters-nav-preview img");
    if (state === "working") {
      icon.classList.add("rotate");
      icon.src = "img/loading.svg";
    } else {
      icon.classList.remove("rotate");
      icon.src = "img/preview.svg";
    }
  },

  // preview: adapt the form elements to the choosen option
  previewPopupState () {
    const mod = document.getElementById("clusters-preview-model-check");
    if (document.querySelector("#clusters-preview-choose-old:checked")) {
      mod.disabled = true;
    } else {
      mod.disabled = false;
    }
  },

  // preview: turn popup off
  previewPopupOff () {
    const popup = document.getElementById("clusters-preview");
    if (!popup?.classList?.contains("visible")) {
      return;
    }
    popup.addEventListener("transitionend", function () {
      this.classList.add("off");
    }, { once: true });
    popup.classList.remove("visible");
  },

  // preview: toggle the state of the preview button
  previewButtonUpdate () {
    const button = document.getElementById("clusters-nav-preview");
    if (viewClusters.data.active === "preview") {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  },

  // glean data for the cluster worker
  //   addModelling = boolean
  //   noNewFiles = boolean
  //   removeTypeCluster = boolean
  gleanWorkerData ({ addModelling, noNewFiles, removeTypeCluster }) {
    // collect domains
    const domains = [];
    for (const v of Object.values(bars.filtersData.domains)) {
      domains.push(v.value);
    }

    // create files data
    const files = {};
    for (const [ k, v ] of Object.entries(xml.data.files)) {
      // skip new files (if requested)
      if (noNewFiles && v.status === 2) {
        continue;
      }
      files[k] = {};
      files[k].domains = [ ...v.domains ];
      files[k].hl = [ ...v.hlJoined ];
      files[k].nl = [ ...v.nlJoined ];
      files[k].links = structuredClone(v.links);
      // remove links of type "Cluster" (if requested)
      if (removeTypeCluster) {
        for (let i = files[k].links.length - 1; i >= 0; i--) {
          if (files[k].links[i].type.includes("Cluster")) {
            files[k].links.splice(i, 1);
          }
        }
      }
    }

    // add links proposed in the modelling (if requested)
    if (addModelling) {
      document.querySelectorAll("#clusters-model-files .file-block").forEach(block => {
        const { file } = block.dataset;
        block.querySelectorAll(".proposals a").forEach(link => {
          const { lemma } = link.dataset;
          files[file].links.push({
            lemma: {
              file: clustersMod.data.center[lemma].file,
              spelling: lemma,
            },
            points: 3,
          });
        });
      });
    }

    // return data
    return {
      domains,
      files,
    };
  },
};

"use strict";

const clustersCheck = {
  // currently marked lemma
  marked: "",

  // build clusters for this view
  build () {
    // prepare section
    const cont = document.querySelector("#clusters-check");
    cont.replaceChildren();
    const jump = document.querySelector("#clusters-nav-new");
    jump.classList.remove("active");

    // no clusters for the current topic domain
    const { data } = viewClusters;
    const c = data[data.active][viewClusters.filters["select-domains"]];
    if (!c.length) {
      cont.appendChild(win.nothingToShow("Keine Cluster gefunden!", "Tipp: Ändern sie die Filtereinstellungen."));
      return;
    }

    // check if the files still exist
    const someFilesAreMissing = viewClusters.checkFiles(c);
    if (someFilesAreMissing) {
      cont.appendChild(someFilesAreMissing);
      return;
    }

    // create grid columns
    for (let i = 0; i < 2; i++) {
      const div = document.createElement("div");
      cont.appendChild(div);
    }

    // prepare data of old clusters and lemmas to compare the new clusters with
    const repoHashes = new Set();
    const repoLemmas = new Set();
    if (data.active === "preview") {
      const cRepo = data.repo?.[viewClusters.filters["select-domains"]] || [];
      for (const cluster of cRepo) {
        repoHashes.add(clustersCheck.hash(cluster));
        for (const circle of [ "z", "s", "u" ]) {
          Object.keys(cluster[circle]).forEach(lemma => repoLemmas.add(lemma));
        }
      }
    }

    // make this section temporarily visible in order to calculate the offsets
    let tempOn = false;
    if (cont.classList.contains("off")) {
      tempOn = true;
      cont.classList.remove("off");
    }

    // fill in clusters
    const [ left, right ] = cont.children;
    const printedLemmas = new Set();
    for (let i = 0, len = c.length; i < len; i++) {
      // this clusters ist excluded via authors filter
      if (!data.idx.includes(i)) {
        continue;
      }

      // create cluster
      const cluster = viewClusters.buildCluster({
        idx: i,
        markLemma: clustersComp.marked,
      });

      // mark new lemmas and changed clusters
      if (data.active === "preview") {
        const hash = clustersCheck.hash(c[i]);
        if (!repoHashes.has(hash)) {
          cluster.classList.add("changed-cluster");
          cluster.querySelectorAll("span").forEach(i => {
            if (!repoLemmas.has(i.dataset.lemma)) {
              i.classList.add("new-lemma");
            }
          });
        }
      }

      // mark filtered clusters
      if (!viewClusters.filters["select-authors"]) {
        let filtered = true;
        for (const lemma of Object.keys(c[i].z)) {
          if (!printedLemmas.has(lemma)) {
            printedLemmas.add(lemma);
            filtered = false;
          }
        }
        if (filtered) {
          cluster.classList.add("filtered-cluster");
        }
      }

      // append cluster
      const leftHeight = left?.lastChild?.getBoundingClientRect().bottom || 0;
      const rightHeight = right?.lastChild?.getBoundingClientRect().bottom || 0;
      if (leftHeight <= rightHeight) {
        left.appendChild(cluster);
      } else {
        right.appendChild(cluster);
      }
    }
    if (tempOn) {
      cont.classList.add("off");
    }

    // initialize tooltips
    tooltip.init(cont);

    // append click events to mark/unmark lemmas
    cont.querySelectorAll("span").forEach(i => {
      i.addEventListener("click", function () {
        const mark = !this.classList.contains("marked");
        viewClusters.markLemma({
          lemma: this.dataset.lemma,
          mark,
          section: clustersCheck,
          sectionName: "check",
        });
      });
    });

    // activate jump icon
    if (cont.querySelector(".changed-cluster")) {
      jump.classList.add("active");
    }
  },

  // calculate a hash in order to compare different cluster states
  //   cluster = object
  hash (cluster) {
    const str = JSON.stringify(cluster);
    return modules.crypto.createHash("sha1").update(str).digest("hex");
  },

  // jump through new clusters
  jump () {
    // detect new clusters
    const changedClusters = document.querySelectorAll("#clusters-check .changed-cluster");
    if (!changedClusters.length) {
      dialog.open({
        type: "alert",
        text: "In der Ansicht befinden sich keine neuen oder geänderten Cluster.",
      });
      return;
    }

    // detect next valid clusters
    const barBottom = document.querySelector("#bar").getBoundingClientRect().bottom;
    const validClusters = [];
    for (const cluster of changedClusters) {
      const rect = cluster.getBoundingClientRect();
      if (rect.top > barBottom + 10) {
        // as we have two columns, we need to detect the position of all new clusters,
        // which are a valid target, and decide later which one is the next in line
        validClusters.push({
          cluster,
          top: rect.top,
        });
      }
    }
    validClusters.sort((a, b) => a.top - b.top);

    // jump to the next cluster in line
    const cluster = validClusters?.[0]?.cluster || changedClusters[0];
    window.scrollTo({
      top: window.scrollY + cluster.getBoundingClientRect().top - barBottom - 10,
      left: 0,
      behavior: "smooth",
    });
  },
};

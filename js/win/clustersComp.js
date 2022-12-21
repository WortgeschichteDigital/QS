"use strict";

const clustersComp = {
  // similar clusters
  similar: {},
  similarSorted: [],

  // currently marked lemma
  marked: "",

  // intersection observer
  // (the last row is observed if there are more to display)
  observer: new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }
      clustersComp.fill();
    });
  }),

  // build clusters for this view
  build () {
    // prepare section
    const cont = document.querySelector("#clusters-compare");
    cont.replaceChildren();
    // search for similar clusters
    const { data } = viewClusters;
    const c = data[data.active][viewClusters.filters["select-domains"]];
    const similarityThreshold = 75;
    clustersComp.similar = {};
    const { similar } = clustersComp;
    for (let i = 0, len = c.length; i < len; i++) {
      if (!data.idx.includes(i)) {
        continue;
      }
      const artI = Object.keys(c[i].z).concat(Object.keys(c[i].s)).concat(Object.keys(c[i].u));
      for (let j = 0, len = c.length; j < len; j++) {
        if (j === i ||
            !data.idx.includes(j) ||
            similar[j + "-" + i]) {
          continue;
        }
        const artJ = Object.keys(c[j].z).concat(Object.keys(c[j].s)).concat(Object.keys(c[j].u));
        let matches = 0;
        for (const art of artI) {
          if (artJ.includes(art)) {
            matches++;
          }
        }
        const similarity = Math.round(matches / (artI.length / 100));
        if (similarity >= similarityThreshold) {
          similar[i + "-" + j] = {
            left: i,
            right: j,
            similarity,
          };
        }
      }
    }
    // no similar clusters found
    if (!Object.keys(similar).length) {
      cont.appendChild(win.nothingToShow("Keine einander ähnlichen Cluster!", "Tipp: Ändern sie die Filtereinstellungen."));
      return;
    }
    // sort similar clusters
    clustersComp.similarSorted = Object.keys(similar);
    clustersComp.similarSorted.sort((a, b) => similar[b].similarity - similar[a].similarity);
    // build table
    const table = document.createElement("table");
    cont.appendChild(table);
    clustersComp.fill();
  },

  // fill table with more results
  fill () {
    const rows = document.querySelectorAll("#clusters-compare tr");
    const start = rows.length;
    if (start > 0) {
      clustersComp.observer.unobserve(rows[start - 1]);
    }
    const table = document.querySelector("#clusters-compare table");
    for (let i = start, len = clustersComp.similarSorted.length; i < len; i++) {
      // ten rows at a time
      if (i !== start &&
          i % 10 === 0) {
        clustersComp.observer.observe(table.lastChild);
        break;
      }
      // row
      const item = clustersComp.similar[clustersComp.similarSorted[i]];
      const tr = document.createElement("tr");
      table.appendChild(tr);
      tr.dataset.left = item.left;
      tr.dataset.right = item.right;
      // left
      const left = document.createElement("td");
      tr.appendChild(left);
      left.appendChild(viewClusters.buildCluster({
        idx: item.left,
        checkModulate: true,
        markLemma: clustersComp.marked,
      }));
      // similarity and add image
      const similarity = document.createElement("td");
      tr.appendChild(similarity);
      similarity.textContent = item.similarity + "\u00A0%";
      const a = document.createElement("a");
      similarity.appendChild(a);
      a.href = "#";
      a.title = "alle Dateien mit Hauptlemmata der Cluster-Zentren zur Modulierung hinzufügen";
      const img = document.createElement("img");
      a.appendChild(img);
      img.src = "img/win/plus.svg";
      img.width = "30";
      img.height = "30";
      img.alt = "";
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        clustersComp.toggleAdd(this.closest("tr"));
      });
      // right
      const right = document.createElement("td");
      tr.appendChild(right);
      right.appendChild(viewClusters.buildCluster({
        idx: item.right,
        checkModulate: true,
        markLemma: clustersComp.marked,
      }));
      // update add image
      clustersComp.updateAddImg(tr);
      // initialize click event to mark lemmas
      tr.querySelectorAll("span").forEach(i => {
        i.addEventListener("click", function () {
          const mark = !this.classList.contains("marked");
          clustersComp.mark(this.dataset.lemma, mark);
        });
      });
    }
    // initialize tooltips
    tooltip.init(table);
  },

  // add all main lemmas of the clusters' center regions to "modulate"
  //   row = node
  toggleAdd (row) {
    // collect files for this row
    const files = [];
    const indices = [
      parseInt(row.dataset.left, 10),
      parseInt(row.dataset.right, 10),
    ];
    const add = /plus\.svg$/.test(row.querySelector("img").src);
    const { data } = viewClusters;
    for (const idx of indices) {
      const cluster = data[data.active][viewClusters.filters["select-domains"]][idx];
      for (const [ lemma, values ] of Object.entries(cluster.z)) {
        if (add && clustersMod.data.files[values.file] ||
            !add && !clustersMod.data.files[values.file] ||
            xml.data.files[values.file].nlJoined.includes(lemma) ||
            files.includes(values.file)) {
          continue;
        }
        files.push(values.file);
      }
    }
    // add or remove files from "modulate"
    for (let i = 0, len = files.length; i < len; i++) {
      const file = files[i];
      if (add) {
        clustersMod.add(file);
      } else {
        clustersMod.fileRemove(file, null, i !== len - 1);
      }
    }
    clustersComp.adaptToModulate();
  },

  // update add image of the given row
  // (detect whether the main lemmas of the clusters' center regions
  // in a row are all added to "modulate")
  //   row = node
  updateAddImg (row) {
    const lemmas = new Set();
    const indices = [
      parseInt(row.dataset.left, 10),
      parseInt(row.dataset.right, 10),
    ];
    const { data } = viewClusters;
    for (const idx of indices) {
      const cluster = data[data.active][viewClusters.filters["select-domains"]][idx];
      for (const [ lemma, values ] of Object.entries(cluster.z)) {
        if (xml.data.files[values.file].nlJoined.includes(lemma)) {
          continue;
        }
        lemmas.add(lemma);
      }
    }
    let allAdded = true;
    for (const lemma of lemmas) {
      if (!clustersMod.data.center[lemma]) {
        allAdded = false;
        break;
      }
    }
    const img = row.querySelector("img");
    if (allAdded) {
      img.src = "img/win/button-yes.svg";
    } else {
      img.src = "img/win/plus.svg";
    }
  },

  // adapt to the files (and lemmas) that are currently added to the modulation
  adaptToModulate () {
    // highlight all lemmas that were added to the modulation
    const { center } = clustersMod.data;
    document.querySelectorAll("#clusters-compare span").forEach(i => {
      const { lemma } = i.dataset;
      if (center[lemma]) {
        i.classList.add("in-modulation");
      } else {
        i.classList.remove("in-modulation");
      }
    });
    // update all add images
    document.querySelectorAll("#clusters-compare tr").forEach(i => clustersComp.updateAddImg(i));
  },

  // mark or unmark lemma
  //   lemma = string
  //   mark = boolean
  mark (lemma, mark) {
    document.querySelectorAll("#clusters-compare .marked").forEach(i => i.classList.remove("marked"));
    if (mark) {
      document.querySelectorAll("#clusters-compare span").forEach(i => {
        if (i.dataset.lemma === lemma) {
          i.classList.add("marked");
        }
      });
      clustersComp.marked = lemma;
    } else {
      clustersComp.marked = "";
    }
  },
};

"use strict";

let clustersMod = {
  // added files and lemmas
  data: {
    // lemmas added
    //   [LEMMA] = object (lemma in the joined form of xml.data.files[file].hlJoined)
    //     file  = string (XML file name)
    //     isFa  = boolean (this lemma represents a field article)
    center: {},
    // files added
    //   [FILE]  = set (contains lemmas, the file links to;
    //                 lemma in the joined form of xml.data.files[file].hlJoined)
    files: {},
  },

  // search lemmas or XML files
  search () {
    const input = document.querySelector("#clusters-modulate-search");
    const text = input.value.trim();
    if (!text) {
      clustersMod.searchOff();
      return;
    }
    // search
    const filters = viewClusters.filters;
    const reg = new RegExp(shared.escapeRegExp(text), "i");
    let results = [];
    for (const [file, data] of Object.entries(xml.data.files)) {
      if (clustersMod.data.files[file] ||
          filters["select-authors"] && !data.authors.includes(filters["select-authors"]) ||
          filters["select-domains"] && !data.domains.includes(filters["select-domains"])) {
        continue;
      }
      if (reg.test(file)) {
        addResult(file, data);
        continue;
      }
      for (const i of data.hlJoined) {
        if (reg.test(i)) {
          addResult(file, data);
          break;
        }
      }
    }
    function addResult (file, data) {
      results.push({
        file,
        hl: data.hlJoined.join(" · "),
        isFa: data.fa,
      });
    }
    // no results
    if (!results.length) {
      clustersMod.searchOff();
      return;
    }
    // sort results
    results.sort((a, b) => shared.sort(a.hl, b.hl));
    // fill popup
    let popup = document.querySelector("#clusters-modulate-popup");
    if (popup) {
      shared.clear(popup);
    } else {
      popup = document.createElement("div");
      input.parentNode.appendChild(popup);
      popup.id = "clusters-modulate-popup";
    }
    for (let i = 0, len = results.length; i < len; i++) {
      if (i === 10) {
        let div = document.createElement("div");
        popup.appendChild(div);
        div.textContent = "…";
        break;
      }
      const item = results[i];
      let a = document.createElement("a");
      popup.appendChild(a);
      if (item.isFa) {
        a.classList.add("fa");
      }
      a.dataset.file = item.file;
      a.href = "#";
      a.innerHTML = `${shared.hClear(item.hl)} <span>${item.file}</span>`;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        clustersMod.add(this.dataset.file);
        clustersMod.searchOff();
      });
    }
    // show popup
    void popup.offsetWidth;
    popup.classList.add("visible");
  },

  // navigate through search results
  //   up = boolean
  searchNav (up) {
    const popup = document.querySelector("#clusters-modulate-popup");
    if (!popup) {
      clustersMod.search();
      return;
    }
    let entries = popup.querySelectorAll("a");
    let active = popup.querySelector(".active");
    let n = -1;
    if (!active && up) {
      return;
    } else if (!active) {
      n = 0;
    } else {
      for (let i = 0, len = entries.length; i < len; i++) {
        if (entries[i] === active) {
          n = i;
          break;
        }
      }
      if (up) {
        n--;
      } else {
        n++;
      }
    }
    if (n === entries.length) {
      return;
    }
    active?.classList?.remove("active");
    if (n >= 0) {
      entries[n].classList.add("active");
    }
  },

  // turn off search popup
  searchOff () {
    let popup = document.querySelector("#clusters-modulate-popup");
    if (!popup ||
        !popup.classList.contains("visible")) {
      return;
    }
    popup.addEventListener("transitionend", function () {
      this.parentNode.removeChild(this);
    }, { once: true });
    popup.classList.remove("visible");
  },

  // add file to the modulation
  //   file = string (XML file name)
  add (file) {
    clustersMod.data.files[file] = new Set();
    clustersMod.filePrint(file);
    clustersMod.center();
    clustersMod.proposals();
    clustersMod.fileToggles();
  },

  // update the whole modulation
  update () {
    // remove files that do not exist anymore
    for (const file of Object.keys(clustersMod.data.files)) {
      if (!xml.data.files[file]) {
        delete clustersMod.data.files[file];
      }
    }
    // build center and file blocks
    shared.clear(document.querySelector("#clusters-modulate-files"));
    for (const file of Object.keys(clustersMod.data.files)) {
      clustersMod.filePrint(file);
    }
    clustersMod.center();
    clustersMod.proposals();
    clustersMod.fileToggles();
  },

  // head icons of each file block
  fileIcons: [
    {
      fun: "app|openPv",
      icon: "xml.svg",
      title: "Datei in der Vorschau öffnen",
    },
    {
      fun: "app|openEditor",
      icon: "open-file.svg",
      title: "Datei im Editor öffnen",
    },
    {
      fun: "clustersMod|fileRemove",
      icon: "close.svg",
      title: "Datei aus der Modulierung entfernen",
    },
  ],

  // show file block of added files
  //   file = string (XML file name)
  filePrint (file) {
    // create block
    let block = document.createElement("div");
    document.querySelector("#clusters-modulate-files").appendChild(block);
    block.classList.add("file-block");
    block.dataset.file = file;
    // create heading
    let h1 = document.createElement("h1");
    block.appendChild(h1);
    h1.textContent = file;
    for (const i of clustersMod.fileIcons) {
      let a = document.createElement("a");
      h1.appendChild(a);
      a.classList.add("icon");
      a.dataset.fun = i.fun;
      a.href = "#";
      a.title = i.title;
      let img = document.createElement("img");
      a.appendChild(img);
      img.src = `img/app/${i.icon}`;
      img.width = "24";
      img.height = "24";
      img.alt = "";
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        const file = this.closest("div").dataset.file;
        const fun = this.dataset.fun.split("|");
        if (fun[0] === "app") {
          app[fun[1]](file);
        } else {
          clustersMod[fun[1]](file, this);
        }
      });
    }
    // add links wrapper
    let list = document.createElement("div");
    block.appendChild(list);
    list.classList.add("file-block-list");
    // prepare proposal area
    let proposals = document.createElement("div");
    list.appendChild(proposals);
    proposals.classList.add("proposals");
    // glean lemma list
    let dataFiles = clustersMod.data.files[file];
    let lemmas = {};
    for (const link of xml.data.files[file].links) {
      if (!link.lemma.file) {
        continue;
      }
      const s = link.lemma.spelling;
      if (lemmas[s]) {
        lemmas[s].links.push({
          line: link.line,
          points: link.points,
        });
      } else {
        const target = xml.data.files[link.lemma.file];
        const isNl = target.nl.includes(link.lemma.spelling);
        if (!isNl) {
          const reg = new RegExp(`(^|\/)${shared.escapeRegExp(link.lemma.spelling)}(\/|$)`);
          for (const hl of target.hlJoined) {
            if (reg.test(hl)) {
              dataFiles.add(hl);
              break;
            }
          }
        }
        lemmas[s] = {
          isFa: target.fa,
          isNl,
          links: [{
            line: link.line,
            points: link.points,
          }],
        };
      }
    }
    // print lemma list
    const lemmasSorted = Object.keys(lemmas).sort((a, b) => shared.sort(a, b));
    for (const lemma of lemmasSorted) {
      const data = lemmas[lemma];
      // create entry
      let entry = document.createElement("div");
      list.appendChild(entry);
      let a = document.createElement("a");
      entry.appendChild(a);
      if (data.isFa) {
        a.classList.add("fa");
      } else if (data.isNl) {
        a.classList.add("nl");
      }
      a.href = "#";
      a.textContent = shared.hClear(lemma);
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        this.nextSibling.classList.toggle("off");
      });
      // create link table
      let table = document.createElement("table");
      entry.appendChild(table);
      table.classList.add("off");
      for (const link of data.links) {
        let tr = document.createElement("tr");
        table.appendChild(tr);
        let th = document.createElement("th");
        tr.appendChild(th);
        th.textContent = `Zeile ${link.line}`;
        let td = document.createElement("td");
        tr.appendChild(td);
        td.textContent = `${link.points} Punkte`;
      }
    }
    // initialize tooltips
    tooltip.init(block);
  },

  // remove a specific file form the modulation
  //   file = string (XML file name)
  //   a = node
  //   bulkRemove = true | undefined
  fileRemove (file, a, bulkRemove = false) {
    if (a) {
      a.dispatchEvent(new Event("mouseout"));
    }
    delete clustersMod.data.files[file];
    const block = document.querySelector(`.file-block[data-file="${file}"]`);
    block.parentNode.removeChild(block);
    if (!bulkRemove) {
      clustersMod.center();
      clustersMod.proposals();
      clustersMod.fileToggles();
    }
  },

  // add or remove toggles to/from all file blocks
  fileToggles () {
    document.querySelectorAll(".file-block").forEach(i => {
      const list = i.querySelector(".file-block-list");
      const n = list.querySelectorAll("a:not(.file-block-toggle-a)").length;
      let toggle = i.querySelector(".file-block-toggle");
      if (n > 6 && !toggle) {
        let div = document.createElement("div");
        list.appendChild(div);
        div.classList.add("file-block-toggle");
        let a = document.createElement("a");
        div.appendChild(a);
        a.classList.add("file-block-toggle-a");
        a.href = "#";
        a.addEventListener("click", function (evt) {
          evt.preventDefault();
          const list = this.closest(".file-block-list");
          list.classList.toggle("open");
          // prevent focus on hidden items
          const items = list.querySelectorAll("a:not(.file-block-toggle-a)");
          for (let i = 4, len = items.length; i < len; i++) {
            if (list.classList.contains("open")) {
              items[i].removeAttribute("tabindex");
            } else {
              items[i].setAttribute("tabindex", "-1");
            }
          }
        });
      } else if (n <= 6 && toggle) {
        toggle.parentNode.removeChild(toggle);
      }
    });
  },

  // construct a cluster center based on the main lemmas of the added files
  // and make proposals of which links should be added to achieve a cluster like that
  center () {
    let center = document.querySelector("#clusters-modulate-center");
    shared.clear(center);
    // update center object
    clustersMod.data.center = {};
    let lemmas = {
      fa: [],
      hl: [],
    };
    for (const file of Object.keys(clustersMod.data.files)) {
      const data = xml.data.files[file];
      for (const hl of data.hlJoined) {
        if (data.fa) {
          lemmas.fa.push(hl);
        } else {
          lemmas.hl.push(hl);
        }
        clustersMod.data.center[hl] = {
          file,
          isFa: data.fa,
        };
      }
    }
    // no cluster center to display
    if (Object.keys(clustersMod.data.files).length < 2) {
      return;
    }
    // construct cluster center
    for (const [type, arr] of Object.entries(lemmas)) {
      if (!arr.length) {
        continue;
      }
      arr.sort(shared.sort);
      let div = document.createElement("div");
      center.appendChild(div);
      if (type === "fa") {
        div.classList.add("fa");
      }
      for (const lemma of arr) {
        let span = document.createElement("span");
        div.appendChild(span);
        span.textContent = shared.hClear(lemma);
      }
    }
  },

  // insert proposals that make clear which lemmas should be added
  proposals () {
    for (const file of Object.keys(clustersMod.data.files)) {
      const block = document.querySelector(`.file-block[data-file="${file}"]`);
      const proposals = block.querySelector(".proposals");
      shared.clear(proposals);
      // collect proposals
      let props = [];
      for (const [lemma, val] of Object.entries(clustersMod.data.center)) {
        if (val.file === file) {
          continue;
        }
        if (!clustersMod.data.files[file].has(lemma)) {
          props.push(lemma);
        }
      }
      // add/remove copy-all link in heading
      const h1 = block.querySelector("h1");
      if (props.length &&
          h1.firstChild.nodeType === Node.TEXT_NODE) {
        let a = document.createElement("a");
        a.classList.add("copy-all");
        a.href = "#";
        a.textContent = h1.firstChild.nodeValue;
        h1.replaceChild(a, h1.firstChild);
        a.addEventListener("click", function (evt) {
          evt.preventDefault();
          clustersMod.proposalsCopyAll(this);
        });
      } else if (!props.length &&
          h1.firstChild.nodeType === Node.ELEMENT_NODE) {
        const text = document.createTextNode(h1.firstChild.textContent);
        h1.replaceChild(text, h1.firstChild);
      }
      // print proposals
      props.sort(shared.sort);
      for (let lemma of props) {
        let a = document.createElement("a");
        proposals.appendChild(a);
        if (clustersMod.data.center[lemma].isFa) {
          a.classList.add("fa");
        }
        a.dataset.lemma = lemma;
        a.href = "#";
        a.textContent = shared.hClear(lemma.split("/")[0]);
        a.addEventListener("click", function (evt) {
          evt.preventDefault();
          clustersMod.proposalsCopy(this);
        });
      }
    }
  },

  // copy XML for a specific proposal
  //   a = node
  proposalsCopy (a) {
    const snippet = clustersMod.proposalsXml(a.dataset.lemma);
    navigator.clipboard.writeText(snippet)
      .then(() => shared.feedback("copied"))
      .catch(() => shared.feedback("error"));
  },

  // copy XML for all proposals
  //   a = node
  proposalsCopyAll (a) {
    let snippets = [];
    a.closest(".file-block").querySelectorAll(".proposals a").forEach(i => {
      const snippet = clustersMod.proposalsXml(i.dataset.lemma);
      snippets.push(snippet);
    });
    navigator.clipboard.writeText(snippets.join("\n"))
      .then(() => shared.feedback("copied"))
      .catch(() => shared.feedback("error"));
  },

  // make XML string with a proposal
  //   lemma = string
  proposalsXml (lemma) {
    const hl = shared.hClear(lemma.split("/")[0]);
    let fa = "";
    if (clustersMod.data.center[lemma].isFa) {
      fa = "Wortfeld-";
    }
    let xml = "<Verweis Typ=\"Cluster\">";
    if (fa) {
      xml += `\n\t<Verweistext>${hl}</Verweistext>`;
    } else {
      xml += "\n\t<Verweistext/>";
    }
    xml += `\n\t<Verweisziel>${fa + hl}</Verweisziel>`;
    xml += "\n</Verweis>";
    return xml;
  },

  // reset the clusters' modulation
  reset () {
    clustersMod.data.center = {};
    clustersMod.data.files = {};
    for (const i of ["center", "files"]) {
      shared.clear(document.querySelector(`#clusters-modulate-${i}`));
    }
    const search = document.querySelector("#clusters-modulate-search");
    search.value = "";
    search.focus();
  },
};

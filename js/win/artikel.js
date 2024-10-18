"use strict";

const artikel = {
  // data for the calculations
  data: {
    // calculation in progress
    calculating: false,
    // clusters as documented in the context of viewClusters.data
    clusters: {},
    // calculation of clusters in progress
    clustersInProgress: false,
    // starting time of the calculation
    clustersStatsStart: null,
    // the resulting Artikel.json
    json: {},
  },

  // worker that calculates the clusters
  worker: null,

  // contents of data.json with Zeitstrahl data (see preferences); important keys:
  //   zeitstrahl.lemmas
  //     [LEMMA|XML-ID] = {}
  //       spelling     = ""  spelling of the lemma
  //       xml          = ""  xml file name
  //       year         = 1   date of first lemma quotation
  //                            4 digits = year
  //                            2 digits = century
  //                            0        = unknown (no quotation for this lemma)
  zeitstrahl: {},

  // contents of data.json with resources data (see preferences); structure:
  //   [LEMMA]    = {}    every spelling of a lemma has an entry of its own
  //     d         = {}   DWDS
  //       checked = ""   ISO 8601 | ""
  //       found   = bool lemma was found
  //     k         = {}   Wiktionary
  //     n         = {}   Wörterbuchnetz
  //     w         = {}   Wortforschungs-DB
  ressourcen: {},

  // open the overlay
  async show () {
    if (!artikel.data.calculating) {
      document.querySelector("#artikel-calculating").classList.add("invisible");
    }
    await artikel.messages();
    overlay.show("artikel");
    document.querySelector("#artikel-calculate").focus();
  },

  // update the messages
  async messages () {
    const branch = await git.branchCurrent();
    const data = [
      {
        type: "zeitstrahl",
        ok: !!prefs.data.zeitstrahl,
      },
      {
        type: "ressourcen",
        ok: !!prefs.data.ressourcen,
      },
      {
        type: "branch",
        ok: branch === "master",
      },
    ];
    for (const i of data) {
      const div = document.querySelector(`#artikel-${i.type}`);
      const img = div.querySelector("img");
      const p = div.querySelector("p:last-child");
      if (i.ok) {
        img.src = "img/win/button-yes.svg";
        p.classList.add("off");
      } else {
        img.src = "img/win/button-no.svg";
        p.classList.remove("off");
      }
    }
  },

  // append the missing data file
  appendData () {
    overlay.show("prefs");
    document.querySelector('#prefs a[href="#data"]').click();
  },

  // change branch to master
  async changeBranch () {
    await git.commandBranch("master");
    artikel.messages();
  },

  // calculate the file contents
  //   cli = boolean
  //   noNew = boolean
  async calculate ({ cli, noNew }) {
    if (artikel.data.calculating) {
      if (!cli) {
        dialog.open({
          type: "alert",
          text: "Die letzte Berechnung ist noch nicht abgeschlossen.",
        });
      }
      return;
    }
    artikel.data.calculating = true;

    // initialize visual feedback
    const calc = document.querySelector("#artikel-calculating");
    const calcImg = calc.firstChild;
    const calcText = calc.lastChild;
    calcImg.src = "img/win/loading.svg";
    calcImg.classList.add("rotate");
    calc.classList.remove("invisible");

    // wait for pending updates
    await xml.updateWait();

    // calculate clusters
    calcText.textContent = "Berechne Cluster …";
    await artikel.makeClusters(noNew);

    // make Artikel.json
    calcText.textContent = "Erstelle Artikel.json …";
    await shared.wait(250);
    artikel.makeJSON(noNew);

    // done
    calcImg.src = "img/win/button-yes.svg";
    calcImg.classList.remove("rotate");
    calcText.textContent = "Artikel.json erstellt!";
    artikel.data.calculating = false;

    // exit if called via CLI
    if (cli) {
      return;
    }

    // save file
    const options = {
      title: "Arikel.json speichern",
      defaultPath: modules.path.join(git.config.dir, "resources", "Artikel.json"),
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
    };
    const result = await modules.ipc.invoke("file-dialog", false, options);
    if (result.canceled || !result.filePath) {
      return;
    }
    try {
      await modules.fsp.writeFile(result.filePath, JSON.stringify(artikel.data.json));
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
    }
  },

  // calculate the cross-reference clusters
  //   noNew = boolean
  async makeClusters (noNew) {
    const { data } = artikel;
    data.clusters = {};
    data.clustersInProgress = true;
    data.clustersStatsStart = new Date();

    // initialize worker
    artikel.worker = new Worker("js/win/workerClusters.js");
    artikel.worker.addEventListener("message", evt => {
      const { data } = artikel;
      data.clusters = evt.data;
      artikel.worker.terminate();
      artikel.worker = null;
      prefs.stats("clusters", data.clustersStatsStart);
      data.clustersInProgress = false;
    });

    // start the calculation
    const workerData = viewClusters.gleanWorkerData({
      addModulation: false,
      noNewFiles: noNew,
      removeTypeCluster: false,
    });
    artikel.worker.postMessage({
      domains: workerData.domains,
      files: workerData.files,
    });

    // wait for the worker to finish
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (!data.clustersInProgress) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });
  },

  // make Artikel.json
  // (documentation of the file's structure: https://www.zdl.org/wb/wgd/api#Artikeldaten)
  //   noNew = boolean
  makeJSON (noNew) {
    const { data } = artikel;
    data.json = {};

    // prepare values
    data.json.articles = {};
    data.json.clusters = {};
    data.json.values = {
      // list of authors
      au: [],
      // diasystemic values
      ds: [],
      // years/centuries of the lemma's first quotation
      eb: [],
      // lemma list (spellings in their joined form as in "hlJoined" or "nlJoined")
      le: [],
      // article positions of sub lemmas (keys refer to the indices in "le")
      nl: {},
      // publication dates
      on: [],
      // resource data
      re: [],
      // semantics
      se: [],
      // topic domains
      tf: [],
      // word fields
      wf: {},
    };

    // fill in values
    const { values: v } = data.json;

    // values.eb
    const { zeitstrahl: zs } = artikel;
    if (zs.lemmas) {
      const years = new Set();
      for (const i of Object.values(zs.lemmas)) {
        const file = xml.data.files[i.xml];
        if (!file ||
            noNew && file.status === 2) {
          continue;
        }
        years.add(i.year);
      }
      v.eb = [ ...years ];
      v.eb.sort((a, b) => a - b);
    }

    for (const file of Object.values(xml.data.files)) {
      // skip new files (if requested)
      if (noNew && file.status === 2) {
        continue;
      }

      // values.au
      for (const au of file.authors) {
        if (!v.au.includes(au)) {
          v.au.push(au);
        }
      }

      // values.ds
      for (const ds of file.diasys) {
        let cat = v.ds.find(i => i[ds.category]);
        if (!cat) {
          v.ds.push({
            [ds.category]: [],
          });
          cat = v.ds.at(-1);
        }
        if (!cat[ds.category].includes(ds.value)) {
          cat[ds.category].push(ds.value);
        }
      }

      // values.le
      for (const le of file.hlJoined.concat(file.nlJoined)) {
        if (!v.le.includes(le)) {
          v.le.push(le);
        }
      }

      // values.nl
      for (let nl of file.nlJoined) {
        const idx = v.le.indexOf(nl);
        [ nl ] = nl.split("/");
        v.nl[idx] = file.nlTargets[nl];
      }

      // values.on
      if (!v.on.includes(file.published)) {
        v.on.push(file.published);
      }

      // values.se
      for (const i of file.links) {
        for (const se of i.type) {
          if (!/Cluster/.test(se) &&
              !v.se.includes(se)) {
            v.se.push(se);
          }
        }
      }

      // values.tf
      for (const tf of file.domains) {
        if (!v.tf.includes(tf)) {
          v.tf.push(tf);
        }
      }
    }
    v.on.sort();
    v.se.sort();

    // values.re
    const { ressourcen: res } = artikel;
    for (const le of v.le) {
      const r = [];
      for (const i of le.split("/")) {
        if (res[i]) {
          let links = "";
          for (const [ site, val ] of Object.entries(res[i])) {
            if (val.found) {
              links += site;
            }
          }
          r.push(links);
        } else {
          r.push("");
        }
      }
      v.re.push(r.join("/"));
    }

    // values.wf
    if (zs.fields) {
      for (const [ domain, fields ] of Object.entries(zs.fields)) {
        if (!v.tf.includes(domain)) {
          continue;
        }
        v.wf[domain] = {};
        for (const [ field, lemmas ] of Object.entries(fields)) {
          v.wf[domain][field] = [];
          for (const lemma of lemmas) {
            if (!v.le.includes(lemma)) {
              continue;
            }
            const idx = v.le.indexOf(lemma);
            v.wf[domain][field].push(idx);
          }
          if (!v.wf[domain][field].length) {
            delete v.wf[domain][field];
          }
        }
      }
    }

    // fill in clusters
    const { clusters: cs } = data;
    const { clusters: ct } = data.json;
    for (const [ domain, clusters ] of Object.entries(cs)) {
      ct[domain] = [];
      for (const c of clusters) {
        const nc = {};
        ct[domain].push(nc);
        for (const circle of [ "z", "s", "u" ]) {
          nc[circle] = {};
          for (const [ lemma, values ] of Object.entries(c[circle])) {
            const idx = v.le.indexOf(lemma);
            nc[circle]["_" + idx] = values.points;
          }
        }
      }
    }

    // fill articles
    const { articles: a } = data.json;
    for (const file of Object.values(xml.data.files)) {
      // skip new files (if requested)
      if (noNew && file.status === 2) {
        continue;
      }

      a[file.id] = {};
      const art = a[file.id];

      // articles.au
      art.au = [];
      for (const i of file.authors) {
        const idx = v.au.indexOf(i);
        art.au.push(idx);
      }

      // articles.ds (filled at the end)
      art.ds = [];

      // articles.eb
      art.eb = [];
      if (zs.lemmas && !file.fa) {
        for (let lemma of file.hl.concat(file.nl)) {
          lemma = shared.hidxClear(lemma);
          const id = lemma + "|" + file.id;
          if (!zs.lemmas[id]) {
            continue;
          }
          const idx = v.eb.indexOf(zs.lemmas[id].year);
          art.eb.push(idx);
        }
      }

      // articles.le
      art.le = [];
      for (const i of file.hlJoined.concat(file.nlJoined)) {
        const idx = v.le.indexOf(i);
        art.le.push(idx);
      }

      // articles.on
      art.on = v.on.indexOf(file.published);

      // articles.se
      art.se = [];
      // [LEMMA] = object
      //   slot  = number (slot of art.se)
      //   types = set (filled with already added types)
      const seLemmas = {};
      for (const link of file.links) {
        if (!link.lemma.file) {
          continue;
        }
        const types = link.type.filter(i => !/Cluster/.test(i));
        if (!types.length) {
          continue;
        }
        const target = xml.data.files[link.lemma.file];
        const reg = new RegExp(`(^|/)${link.lemma.spelling}(/|$)`);
        let lemma;
        for (const l of target.hlJoined.concat(target.nlJoined)) {
          if (reg.test(l)) {
            lemma = l;
            break;
          }
        }
        const idx = v.le.indexOf(lemma);
        for (const type of types) {
          if (seLemmas?.[lemma]?.types?.has(type)) {
            continue;
          }
          if (!seLemmas[lemma]) {
            seLemmas[lemma] = {
              slot: art.se.length,
              types: new Set(),
            };
            art.se.push([ idx ]);
          }
          seLemmas[lemma].types.add(type);
          art.se[seLemmas[lemma].slot].push(v.se.indexOf(type));
        }
      }

      // articles.tf
      art.tf = [];
      for (const i of file.domains) {
        const idx = v.tf.indexOf(i);
        art.tf.push(idx);
      }

      // articles.wa
      art.wa = file.fa ? 1 : 0;

      // articles.ds
      // [idxCat + "-" + idxVal] = object
      //   lemmas = set (already added lemmas)
      //   slot   = number (slot of art.ds)
      const dsSlots = {};
      for (const dia of file.diasys) {
        const idxCat = v.ds.findIndex(i => i[dia.category]);
        const idxVal = v.ds[idxCat][dia.category].indexOf(dia.value);
        const id = idxCat + "-" + idxVal;
        const hlLen = file.hlJoined.length;
        if (dsSlots[id] && hlLen === 1) {
          continue;
        }
        if (!dsSlots[id]) {
          dsSlots[id] = {
            lemmas: new Set(),
            slot: art.ds.length,
          };
          art.ds.push([ idxCat, idxVal ]);
        }
        if (hlLen > 1 &&
            !dsSlots[id].lemmas.has(dia.lemma)) {
          dsSlots[id].lemmas.add(dia.lemma);
          const { slot } = dsSlots[id];
          if (!art.ds[slot][2]) {
            art.ds[slot].push([]);
          }
          const idxLemma = v.le.indexOf(dia.lemma);
          const idx = art.le.indexOf(idxLemma);
          art.ds[slot][2].push(idx);
        }
      }
    }
  },
};

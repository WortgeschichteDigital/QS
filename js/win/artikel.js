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

  // open the overlay
  async show () {
    if (!artikel.data.calculating) {
      document.querySelector("#artikel-calculating").classList.add("invisible");
    }
    await artikel.messages();
    overlay.show("artikel");
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
  appendZeitstrahl () {
    overlay.show("prefs");
    document.querySelector('#prefs a[href="#data"]').click();
  },

  // change branch to master
  async changeBranch () {
    await git.commandBranch();
    artikel.messages();
  },

  // calculate the file contents
  async calculate () {
    if (artikel.data.calculating) {
      dialog.open({
        type: "alert",
        text: "Die letzte Berechnung ist noch nicht abgeschlossen.",
      });
      return;
    }
    artikel.data.calculating = true;
    await xml.updateWait();

    // initialize visual feedback
    const calc = document.querySelector("#artikel-calculating");
    const calcImg = calc.firstChild;
    const calcText = calc.lastChild;
    calcImg.src = "img/win/loading.svg";
    calcImg.classList.add("rotate");
    calc.classList.remove("invisible");

    // calculate clusters
    calcText.textContent = "Berechne Cluster …";
    await artikel.makeClusters();

    // make Artikel.json
    calcText.textContent = "Erstelle Artikel.json …";
    await shared.wait(250);
    artikel.makeJSON();

    // done
    calcImg.src = "img/win/button-yes.svg";
    calcImg.classList.remove("rotate");
    calcText.textContent = "Artikel.json erstellt!";

    // export file
    const options = {
      title: "Arikel.json speichern",
      defaultPath: shared.path.join(git.config.dir, "resources", "Artikel.json"),
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
    };
    const result = await shared.ipc.invoke("file-dialog", false, options);
    if (result.canceld || !result.filePath) {
      return;
    }
    try {
      await shared.fsp.writeFile(result.filePath, JSON.stringify(artikel.data.json));
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
    }
    artikel.data.calculating = false;
  },

  // calculate the cross-reference clusters
  async makeClusters () {
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
    const workerData = viewClusters.gleanWorkerData(false, false);
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
  makeJSON () {
    const { data } = artikel;
    data.json = {};
    // TODO
  },
};

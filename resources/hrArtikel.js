"use strict";

const { promises: fsp } = require("fs");
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "Artikel.json");

(async function () {
  // check whether the file is accesible or not
  const result = await new Promise(resolve => {
    fsp.access(file)
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });
  if (!result) {
    console.log("\nUsage: node hrArtikel.js [path]");
    console.log("\n       The argument \"path\" may be omitted if the Artikel.json");
    console.log("       is in the same directory as this script.");
    process.exit(1);
  }

  // read file
  const content = await fsp.readFile(file, { encoding: "utf8" });
  const json = JSON.parse(content);

  // articles
  const { values: v } = json;
  for (const a of Object.values(json.articles)) {
    // .au
    for (let i = 0, len = a.au.length; i < len; i++) {
      const idx = a.au[i];
      a.au[i] = v.au[idx];
    }

    // .ds
    for (let i = 0, len = a.ds.length; i < len; i++) {
      const [ slot ] = a.ds[i];
      const [ cat ] = Object.keys(v.ds[slot]);
      const idx = a.ds[i][1];
      const val = v.ds[slot][cat][idx];
      a.ds[i][0] = cat;
      a.ds[i][1] = val;
      if (a.ds[i][2]) {
        for (let j = 0, len = a.ds[i][2].length; j < len; j++) {
          const idx = a.le[a.ds[i][2][j]];
          a.ds[i][2][j] = v.le[idx];
        }
      }
    }

    // .eb
    for (let i = 0, len = a.eb.length; i < len; i++) {
      const idx = a.eb[i];
      a.eb[i] = v.eb[idx];
    }

    // .le
    for (let i = 0, len = a.le.length; i < len; i++) {
      const idx = a.le[i];
      a.le[i] = v.le[idx];
    }

    // .on
    a.on = v.on[a.on];

    // .se
    for (let i = 0, len = a.se.length; i < len; i++) {
      for (let j = 0, len = a.se[i].length; j < len; j++) {
        const idx = a.se[i][j];
        if (!j) {
          a.se[i][j] = v.le[idx];
        } else {
          a.se[i][j] = v.se[idx];
        }
      }
    }

    // .tf
    for (let i = 0, len = a.tf.length; i < len; i++) {
      const idx = a.tf[i];
      a.tf[i] = v.tf[idx];
    }

    // .wa
    a.wa = !!a.wa;
  }

  // clusters
  for (const clusters of Object.values(json.clusters)) {
    for (const cluster of clusters) {
      for (const circle of [ "z", "s", "u" ]) {
        for (const [ lemma, points ] of Object.entries(cluster[circle])) {
          const idx = parseInt(lemma.substring(1), 10);
          cluster[circle][v.le[idx]] = points;
          delete cluster[circle][lemma];
        }
      }
    }
  }

  // word fields
  for (const fields of Object.values(json.values.wf)) {
    for (const values of Object.values(fields)) {
      for (let i = 0, len = values.length; i < len; i++) {
        const idx = values[i];
        values[i] = v.le[idx];
      }
    }
  }

  // write out data
  const inputName = file.split(path.sep).at(-1);
  const [ base, ext ] = inputName.split(".");
  const outputName = `${base}_hr.${ext}`;
  await fsp.writeFile(path.join(__dirname, outputName), JSON.stringify(json, null, 2));

  // print result and exit
  console.log(`File converted to output file "${outputName}"!`);
  process.exit(0);
}());

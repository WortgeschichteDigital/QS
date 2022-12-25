"use strict";

importScripts("../shared/shared.js");

const clusters = {
  // worker data
  data: {
    // set of cluster centers that were already checked
    // (this is vital to speed up the calculation)
    checked: new Set(),
    // list of currently available domains
    domains: [],
    // file data for calculation
    //   [FILENAME]     = {}
    //     domains      = []  domains of this article)
    //     hl           = ""  main lemmas (clone of xml.data.files[FILENAME].hlJoined)
    //     nl           = ""  sub lemmas (clone of xml.data.files[FILENAME].nlJoined)
    //     links        = []  clone of xml.data.files[FILENAME].links; important keys as follows
    //                        (links added from the modulation only contain the keys mentioned below)
    //       lemma      = {}
    //         file     = ""  XML file name
    //         spelling = ""  spelling als in "hl" or "nl";
    //                        converted by clusters.convertSpelling
    //       points     = 1   cluster points for this link
    files: {},
    // mappers for quick detection of sub lemmas and corresponding domains
    mappers: {
      // structure "domains":
      //   [LEMMA] = set  clone of data.files[FILENAME].domains;
      //                  (contains all lemmas, main and sub lemmas alike)
      domains: {},
      // structure "files"
      //   [LEMMA] = ""  XML file name
      files: {},
      // set with all sub lemmas
      nl: new Set(),
    },
    // calculation result
    // (same data structure as viewClusters.data.repo)
    result: {},
    // link targets
    //   [TARGETED LEMMA]  = {}  lemma as in data.files.hl|nl
    //     [LINKING LEMMA] = 1   lemma as in data.files.hl|nl = cluster points
    // "targeted lemma" is the target of a link
    // "linking lemma" is the main lemma of the article wherein the link is located
    //   (in case an article has multiple main lemmas: each of the main lemmas
    //   creates a "linking lemma" entry of its own)
    targets: {},
  },

  // create object with link targets and cluster points
  prepare () {
    const { data: d } = clusters;
    d.mappers.domains = {};
    d.mappers.files = {};
    d.mappers.nl = new Set();
    d.targets = {};
    for (const [ file, data ] of Object.entries(d.files)) {
      // fill mappers
      for (const lemmaType of [ "hl", "nl" ]) {
        for (const i of data[lemmaType]) {
          d.mappers.domains[i] = new Set([ ...data.domains ]);
          d.mappers.files[i] = file;
          if (lemmaType === "nl") {
            d.mappers.nl.add(i);
          }
        }
      }

      // scan links
      for (const i of data.links) {
        // 1. convert spellings
        if (!i.lemma.spelling) {
          // spelling could not be detected due to an erroneous link
          continue;
        }
        const target = d.files[i.lemma.file];
        const targetLemmas = target.hl.concat(target.nl);
        if (!targetLemmas.includes(i.lemma.spelling)) {
          const reg = new RegExp(`(^|/)${shared.escapeRegExp(i.lemma.spelling)}(/|$)`);
          for (const lemma of targetLemmas) {
            if (reg.test(lemma)) {
              i.lemma.spelling = lemma;
              break;
            }
          }
        }

        // 2. fill targets object
        const spell = i.lemma.spelling;
        for (const hl of data.hl) {
          if (!d.targets[spell]) {
            d.targets[spell] = {};
          }
          if (!d.targets[spell][hl]) {
            d.targets[spell][hl] = 0;
          }
          d.targets[spell][hl] += i.points;
        }
      }
    }
  },

  // calculate clusters
  calculate () {
    const { data: d } = clusters;
    d.checked = new Set();
    d.result = {};

    // structured array with all lemma combinations of a possible cluster center;
    // each slot contains all combinations of a specific number of lemmas like so:
    //   [
    //     [
    //       [ "elitär", "Elite", "Establishment" ],
    //     ],
    //     [
    //       [ "elitär", "Elite" ],
    //       [ "elitär", "Establishment" ],
    //       [ "Elite", "Establishment" ],
    //     ]
    //   ]
    let comb = [];
    // all unique combinations that are currently calculated for a sepcific number of lemmas
    let combCurrent = [];
    // number of lemmas for which currently all unique combinations are calculated
    let combCurrentNo = 0;
    // closure to create all unique combinations of cluster centers
    //   len = number
    //   start = number
    function combFill (len, start) {
      if (len === 0) {
        comb[comb.length - 1].push([ ...combCurrent ]);
        return;
      }
      for (let i = start; i <= comb[0][0].length - len; i++) {
        combCurrent[combCurrentNo - len] = comb[0][0][i];
        combFill(len - 1, i + 1);
      }
    }

    // calculate clusters per domain
    for (const domain of d.domains) {
      // all clusters of this domain; structure:
      //   z         = {}   center (Zentrum): lemmas that mutually refer to each other
      //     [LEMMA] = 1    summed up weight of the links that refer to this lemma
      //                      (the weight is only calculated by analyzing the links
      //                      that pertain to lemmas of the same center)
      //   s         = {}   fringe (Saum): lemmas that are referred to from the center
      //     [LEMMA] = 1    summed up weight of the links from the cluster center to this particular lemma
      //   u         = {}   periphery (Umfeld): lemmas that point to the center
      //                      without there being any lemma that points back to them
      //     [LEMMA] = 1    summed up weight of the links from this lemma to the cluster center
      const c = [];

      for (const [ target, lemmas ] of Object.entries(d.targets)) {
        // ignore sub lemmas at all and main lemms if they are from a different topic domain
        if (d.mappers.nl[target] ||
            !d.mappers.domains[target].has(domain)) {
          continue;
        }

        // I. DETECT CENTER
        // (lemmas that mutually refer to each other)

        // create all imaginable unique combinations of cluster centers
        // (lemmas are only regarded if they form a reciprocal reference with "target")
        comb = [ [ [ target ] ] ];
        for (const lemma of Object.keys(lemmas)) {
          if (d.targets?.[lemma]?.[target]) {
            comb[0][0].push(lemma);
          }
        }
        if (comb[0][0].length > 2 && comb[0][0].length < 11) { // TODO 13!
          // create all possible unique combinations
          // (max. of 12 lemmas, otherwise the calculation takes much too long)
          for (let i = comb[0][0].length - 1; i >= 2; i--) {
            comb.push([]);
            combCurrent = [];
            combCurrentNo = i;
            combFill(i, 0);
          }
        }

        // check the possible combinations of cluster centers
        for (const combinations of comb) {
          for (const combination of combinations) {
            // speed up the process by skipping already checked combinations
            combination.sort();
            const combinationJoined = combination.join();
            if (d.checked.has(combinationJoined)) {
              continue;
            }
            d.checked.add(combinationJoined);

            // apply and test the possible cluster centers
            const z = {};
            for (const lemma of combination) {
              z[lemma] = 0;
            }

            // delete lemmas that do not refer to every other lemma of this combination
            const zDel = new Set();
            for (const lemmaI of Object.keys(z)) {
              if (lemmaI === target) {
                continue;
              }
              for (const lemmaJ of Object.keys(z)) {
                if (lemmaJ === lemmaI || zDel.has(lemmaJ)) {
                  // - don't compare lemmas with themselves
                  // - skip already dismissed lemmas
                  continue;
                }
                if (!d.targets[lemmaJ][lemmaI]) {
                  zDel.add(lemmaI);
                  break;
                }
              }
            }
            for (const lemma of zDel) {
              delete z[lemma];
            }

            // delete lemmas that do not pertain to the current topic domain
            // (save them to readd them afterwards if there is a valid cluster center)
            const differentDomain = new Set();
            for (const lemma of Object.keys(z)) {
              if (!d.mappers.domains[lemma].has(domain)) {
                differentDomain.add(lemma);
                delete z[lemma];
              }
            }

            // the possible combination forms no center => check next combination
            if (Object.keys(z).length < 2) {
              continue;
            }

            // add main and sub lemmas to the center
            // if they pertain to the same multi lemma article
            for (const lemma of Object.keys(z)) {
              const file = d.files[d.mappers.files[lemma]];
              for (const lemmaType of [ "hl", "nl" ]) {
                for (const lemma of file[lemmaType]) {
                  if (typeof z[lemma] === "undefined") {
                    z[lemma] = 0;
                  }
                }
              }
            }

            // readd temporarily removed lemmas from different topic domains
            for (const lemma of differentDomain) {
              z[lemma] = 0;
            }

            // sum up the weight of the lemmas in the center
            for (const target of Object.keys(z)) {
              if (!d.targets[target]) {
                // sub lemmas can only be found within the "targets" object
                // if they were referred directly
                continue;
              }
              for (const [ lemma, weight ] of Object.entries(d.targets[target])) {
                if (typeof z[lemma] !== "undefined") {
                  z[target] += weight;
                }
              }
            }

            // remove main and sub lemmas without points from the center
            for (const [ lemma, weight ] of Object.entries(z)) {
              if (!weight) {
                delete z[lemma];
              }
            }

            // II. DETECT FRINGE
            // (lemmas that are referred to from the center)
            const s = {};
            for (const [ target, lemmas ] of Object.entries(d.targets)) {
              for (const lemma of Object.keys(lemmas)) {
                if (!z[lemma] || z[lemma] && z[target]) {
                  // skip this "target" if
                  //   - the lemma is not part of the cluster center
                  //   - the lemma and its target are both part of the cluster center
                  continue;
                }
                if (typeof s[target] === "undefined") {
                  s[target] = 0;
                }
                s[target] += d.targets[target][lemma];
                if (d.targets[lemma][target]) {
                  // there is a reciprocal reference between the lemmas "target"
                  // and "lemma", while target is not part of this cluster's center
                  // => this lemma should appear in the upper bundle of the fringe
                  s[target] += 1000;
                }
              }
            }

            // III. DETECT PERIPHERY
            // (lemmas that point to the center
            // without there being any lemma that points back to them)
            const u = {};
            for (const target of Object.keys(z)) {
              if (!d.targets[target]) {
                // sub lemmas can only be found within the "targets" object
                // if they were refered to directly
                continue;
              }
              for (const [ lemma, weight ] of Object.entries(d.targets[target])) {
                if (z[lemma] || s[lemma]) {
                  // lemma is already part of center or fringe => ignore it
                  continue;
                }
                if (typeof u[lemma] === "undefined") {
                  u[lemma] = 0;
                }
                u[lemma] += weight;
              }
            }

            // save cluster
            c.push({
              z,
              s,
              u,
            });
          }
        }
      }

      // erase duplicats
      // (due to the system, many cluster centers are calculated that are duplicats
      // of already pushed clusters; one could prevent that at first hand, but this way
      // a lemma can be part of several different cluster centers at once, what seems
      // to be a good idea in general; but we have to make sure that there are no
      // small cluster centers that are a subset of bigger centers)
      const centers = [];
      for (let i = 0, len = c.length; i < len; i++) {
        const center = Object.keys(c[i].z).sort();
        centers.push(center);
      }
      const centersDel = new Set();
      for (let i = 0, len = centers.length; i < len; i++) {
        if (centersDel.has(i)) {
          continue;
        }
        for (let j = 0, len = centers.length; j < len; j++) {
          if (i === j ||
              centersDel.has(j)) {
            continue;
          }

          // Are the centers identical?
          if (centers[j].join() === centers[i].join()) {
            centersDel.add(i);
            continue;
          }

          // Is the smaller center a subset of the bigger center?
          let big = i;
          let small = j;
          if (centers[j].length > centers[i].length) {
            big = j;
            small = i;
          }
          const matches = Array(centers[small].length).fill(false);
          for (let k = 0, len = centers[small].length; k < len; k++) {
            if (centers[big].includes(centers[small][k])) {
              matches[k] = true;
            }
          }
          if (!matches.some(i => !i)) {
            // no false in array => all lemmas are part of the bigger center => delete the smaller center
            centersDel.add(small);
          }
        }
      }
      for (let i = c.length - 1; i >= 0; i--) {
        if (centersDel.has(i)) {
          c.splice(i, 1);
        }
      }

      // sort clusters of the current domain
      // 1. sort by lemma count in the cluster circles
      c.sort((a, b) => {
        const c = Object.keys(a.z).length;
        const d = Object.keys(b.z).length;
        if (c === d) {
          const e = Object.keys(a.s).length;
          const f = Object.keys(b.s).length;
          if (e === f) {
            const g = Object.keys(a.u).length;
            const h = Object.keys(b.u).length;
            // fallback 2: sort by number of lemmas in the peripheries
            return h - g;
          }
          // fallback 1: sort by number of lemmas in the fringes
          return f - e;
        }
        // default: sort by number of lemmas in the centers
        return d - c;
      });

      // 2. sort the circles by weight
      // 3. fill the results object in the expected form
      d.result[domain] = [];
      for (const i of c) {
        const currentCluster = {};
        for (const circle of [ "z", "s", "u" ]) {
          // sort lemmas
          const lemmas = Object.keys(i[circle]);
          lemmas.sort((a, b) => {
            if (i[circle][a] === i[circle][b]) {
              // same weight => sort alphabetically
              shared.sortModeForLemmas = true;
              const result = shared.sort(a, b);
              shared.sortModeForLemmas = false;
              return result;
            }
            // different weight => sort by weight
            return i[circle][b] - i[circle][a];
          });
          // rebuild current cluster
          currentCluster[circle] = {};
          for (const lemma of lemmas) {
            currentCluster[circle][lemma] = {
              file: d.mappers.files[lemma],
              points: i[circle][lemma],
            };
          }
        }
        d.result[domain].push(currentCluster);
      }
    }
  },
};

self.addEventListener("message", evt => {
  // initialize data
  const { data: d } = clusters;
  d.domains = evt.data.domains;
  d.files = evt.data.files;
  // prepare the received data
  clusters.prepare();
  // calculate clusters
  clusters.calculate();
  // return result
  postMessage(d.result);
});

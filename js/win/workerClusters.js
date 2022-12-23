"use strict";

importScripts("../shared/shared.js");

const clusters = {
  // worker data
  data: {
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
      // structure:
      //   [LEMMA] = []  clone of data.files[FILENAME].domains;
      //                 contains all main and sub lemmas alike
      domains: {},
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
    //   (in case of articles with multiple main lemmas: each of the main lemmas
    //   creates a "linking lemma" entry of its own)
    targets: {},
  },

  // create object with link targets and clusters points
  prepare () {
    const { data: d } = clusters;
    d.mappers.domains = {};
    d.mappers.nl = new Set();
    d.targets = {};
    for (const data of Object.values(d.files)) {
      // fill mappers
      for (const i of data.hl) {
        d.mappers.domains[i] = [ ...data.domains ];
      }
      for (const i of data.nl) {
        d.mappers.domains[i] = [ ...data.domains ];
        d.mappers.nl.add(i);
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
    d.result = {};
    // TODO attention: some links don't have a spelling due to a linking error
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

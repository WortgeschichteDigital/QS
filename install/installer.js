"use strict";

const fs = require("fs");
const { promises: fsp } = fs;

module.exports = {
  // check build folder
  makeBuild () {
    return new Promise(resolve => {
      if (!fs.existsSync("../build")) {
        fsp.mkdir("../build")
          .then(() => {
            resolve(true);
          })
          .catch(err => {
            throw new Error(err.message);
          });
      } else {
        resolve(true);
      }
    });
  },

  // create empty changelog (if necessary)
  makeChangelog () {
    return new Promise(resolve => {
      if (!fs.existsSync("../build/changelog")) {
        fsp.writeFile("../build/changelog", "")
          .then(() => {
            resolve(true);
          })
          .catch(err => {
            throw new Error(err.message);
          });
      } else {
        resolve(true);
      }
    });
  },

  // collect keywords
  getKeywords () {
    return new Promise(resolve => {
      fsp.readFile("./package.json", {
        encoding: "utf8",
      })
        .then(result => {
          resolve(JSON.parse(result).keywords.join(";"));
        })
        .catch(err => {
          throw new Error(err.message);
        });
    });
  },

  // detect copyright year
  getYear () {
    const current = new Date().getFullYear();
    let year = "2022";
    if (current > 2022) {
      year += `–${current}`;
    }
    return year;
  },
};

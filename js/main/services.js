"use strict";

const { dialog } = require("electron");
const fsp = require("fs").promises;
const path = require("path");

let svg = [];

module.exports = {
  // check whether a file exists or not
  //   file = string (path to file)
  exists (file) {
    return new Promise(resolve => {
      fsp.access(file)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  },

  // show file dialog
  //   bw = object (browser window)
  //   open = boolean (true: showOpenDialog(), false: showSaveDailog())
  //   options = object
  fileDialog ({ bw, open, options }) {
    return new Promise(resolve => {
      if (open) {
        dialog.showOpenDialog(bw, options)
          .then(result => resolve(result))
          .catch(err => resolve(err));
      } else {
        dialog.showSaveDialog(bw, options)
          .then(result => resolve(result))
          .catch(err => resolve(err));
      }
    });
  },

  // return a list of all SVG files in folder /img/app/
  async svg () {
    if (!svg.length) {
      svg = await fsp.readdir(path.join(__dirname, "..", "..", "img", "app"));
    }
    return svg;
  },
};

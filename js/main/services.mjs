
import { dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = import.meta.dirname;

let svg = [];

export default {
  // check whether a file exists or not
  //   file = string (path to file)
  exists (file) {
    return new Promise(resolve => {
      fs.access(file)
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

  // return a list of all SVG files in folder "img"
  async svg () {
    if (!svg.length) {
      const result = await fs.readdir(path.join(__dirname, "..", "..", "img"));
      svg = result;
    }
    return svg;
  },
};

"use strict";

// package type
let type = process.argv[2];
if (!type || !/^(darwin|linux|win32)$/.test(type)) {
  type = "linux";
}

// preparation
const packager = require("electron-packager");
const prepare = require("./installer");
const year = prepare.getYear();

const config = {
  platform: type,
  arch: "x64",
  dir: "./",
  out: process.argv[3] || "../build",
  executableName: "QS",
  extraResource: [],
  ignore: [ /node_modules/, /package-lock\.json/ ],
  overwrite: true,
  asar: true,
  prune: true,
  junk: true,
  name: "QS",
  appCopyright: `© ${year}, Akademie der Wissenschaften zu Göttingen`,
};

switch (type) {
  case "darwin":
    config.icon = "./img/icon/mac/icon.icns";
    config.appCategoryType = "public.app-category.utilities";
    break;
  case "win32":
    config.icon = "./img/icon/win/icon.ico";
    config.win32metadata = {
      CompanyName: "Nico Dorn <ndorn@gwdg.de>",
      FileDescription: "QS",
      ProductName: "QS",
      InternalName: "QS",
    };
    break;
}

// packager
(async function () {
  // fill resources file list
  const files = await prepare.lsResources();
  const path = require("path");
  for (const f of files) {
    config.extraResource.push(path.join("resources", f));
  }

  // package app
  packager(config)
    .then(() => {
      let os = "Linux";
      if (type === "darwin") {
        os = "macOS";
      } else if (type === "win32") {
        os = "Windows";
      }
      console.log(`${os} package created!`);
    })
    .catch(err => {
      console.log(new Error(err));
      process.exit(1);
    });
}());

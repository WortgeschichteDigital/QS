"use strict";

// package type
const type = "nsis";

// maintainer mail
let email = process.argv[3];
if (!email || !/^.+@.+\..+$/.test(email)) {
  email = "no-reply@adress.com";
}

// preparation
const builder = require("electron-builder");
const Arch = builder.Arch;
const Platform = builder.Platform;
const prepare = require("./installer");
const year = prepare.getYear();
let config = {};

prepare.makeBuild()
  .then(() => {
    makeConfig();
    startInstaller();
  })
  .catch(err => {
    console.log(new Error(err));
    process.exit(1);
  });

// configuration
function makeConfig () {
  config = {
    targets: Platform.WINDOWS.createTarget(null, Arch.x64),
    config: {
      extraMetadata: {
        author: {
          email: email,
        },
      },
      appId: "zdl.wgd.QS",
      productName: "QS",
      copyright: `© ${year}, Akademie der Wissenschaften zu Göttingen`,
      directories: {
        output: "../build",
      },
      win: {
        target: type,
        icon: "./img/icon/win/icon.ico",
      },
      [type]: {
        artifactName: "QS_${version}_x64.${ext}",
        license: "./LICENSE",
        shortcutName: "QS",
      },
      extraResources: [
        {
          from: "./resources",
          to: "./",
          filter: ["*.xsl"],
        },
      ],
    },
  };
}

// installer
function startInstaller () {
  builder.build(config)
    .then(() => console.log("Windows installer created!"))
    .catch(err => {
      console.log(new Error(err));
      process.exit(1);
    });
}

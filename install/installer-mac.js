"use strict";

// package type
const type = "dmg";

// maintainer mail
let email = process.argv[3];
if (!email || !/^.+@.+\..+$/.test(email)) {
  email = "no-reply@adress.com";
}

// preparation
const builder = require("electron-builder");
const { Arch } = builder;
const { Platform } = builder;
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
    targets: Platform.MAC.createTarget(null, Arch.x64),
    config: {
      extraMetadata: {
        author: {
          email,
        },
      },
      appId: "zdl.wgd.QS",
      productName: "QS",
      copyright: `© ${year}, Akademie der Wissenschaften zu Göttingen`,
      directories: {
        output: "../build",
      },
      mac: {
        target: type,
        icon: "./img/icon/mac/icon.icns",
        category: "public.app-category.utilities",
      },
      [type]: {
        artifactName: "QS_${version}_${arch}.${ext}",
        background: "./installer/mac-background.png",
        title: "${productName} ${version}",
      },
      extraResources: [
        {
          from: "./resources",
          to: "./",
          filter: [ "*.js", "*.tt", "*.xsl" ],
        },
      ],
    },
  };
}

// installer
function startInstaller () {
  builder.build(config)
    .then(() => console.log("macOS installer created!"))
    .catch(err => {
      console.log(new Error(err));
      process.exit(1);
    });
}

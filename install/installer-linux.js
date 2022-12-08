"use strict";

// package type
let type = process.argv[2];
if (!type || !/^(appImage|deb|rpm)$/.test(type)) {
	type = "deb";
}

// maintainer mail
let email = process.argv[3];
if (!email || !/^.+@.+\..+$/.test(email)) {
	email = "no-reply@adress.com";
}

// preparation
const builder = require("electron-builder"),
	Arch = builder.Arch,
	Platform = builder.Platform,
	prepare = require("./installer"),
	year = prepare.getYear();
let keywords = "",
	config = {};

prepare.makeBuild()
	.then(async () => {
		if (type === "appImage") {
			return;
		} else {
			await prepare.makeChangelog();
		}
	})
	.then(async () => {
		if (type === "appImage") {
			return;
		} else {
			keywords = await prepare.getKeywords();
		}
	})
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
		targets: Platform.LINUX.createTarget(null, Arch.x64),
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
			linux: {
				target: type,
				executableName: "QS",
				artifactName: "QS_${version}_${arch}.${ext}",
				icon: "./img/icon/linux/",
				synopsis: "App zur Qualitätssicherung von „Wortgeschichte digital“",
				category: "Science",
				desktop: {
					Name: "QS",
					Keywords: keywords,
				},
			},
			[type]: {
				packageCategory: "science",
				fpm: [
					`--${type}-changelog=../build/changelog`,
				],
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
	if (type === "appImage") {
		delete config.config.appImage;
		config.config.appImage = {
			license: "./LICENSE",
		};
	} else if (type === "deb") {
		config.config[type].priority = "optional";
	}
}

// installer
function startInstaller () {
	builder.build(config)
		.then(() => {
			if (type === "appImage") {
				console.log("Linux package created!");
			} else {
				console.log("Linux installer created!");
			}
		})
		.catch(err => {
			console.log(new Error(err));
			process.exit(1);
		});
}

"use strict";

let shared = {
	// wait for the given milliseconds
	//   ms = integer
	async wait (ms) {
		return new Promise(resolve => setTimeout(() => resolve(true), ms));
	},
};

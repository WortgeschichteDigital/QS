"use strict";

let dialog = {
	// user response to the currently shown dialog (undefined | null | true | false)
	response: undefined,
	// show dialog
	//   type = string (alert | confirm | pass)
	//   text = string
	//   wait = true | undefined (wait 3 sec to activate the yes button)
	async open ({ type, text, wait = false }) {
		// already open dialogs should stop waiting for response
		const win = document.querySelector("#dialog");
		if (!win.classList.contains("hide")) {
			dialog.response = null;
			await shared.wait(30);
		}
		// prepare for user response
		dialog.response = undefined;
		// print text
		const t = document.querySelector("#dialog-text");
		while (t.hasChildNodes()) {
			t.removeChild(t.lastChild);
		}
		for (const i of text.split("\n")) {
			let p = document.createElement("p");
			t.appendChild(p);
			p.innerHTML = i;
		}
		// print password field
		if (type === "pass") {
			let p = document.createElement("p");
			t.appendChild(p);
			let input = document.createElement("input");
			p.appendChild(input);
			input.type = "password";
			input.value = "";
			input.placeholder = "Passwort";
			input.addEventListener("keydown", function(evt) {
				if (evt.key === "Enter" && !shared.detectKeyboardModifiers(evt)) {
					document.querySelector("#dialog-okay").click();
				}
			});
		}
		// set buttons
		win.dataset.type = type;
		// show dialog
		overlay.show("dialog");
		if (type === "pass") {
			document.querySelector("#dialog input").focus();
		} else {
			if (wait) {
				const yes = document.querySelector("#dialog-yes");
				yes.disabled = true;
				await shared.wait(3e3);
				if (win.classList.contains("hide")) {
					return dialog.response;
				}
				yes.disabled = false;
				yes.focus();
			} else {
				document.querySelector(`#dialog-${type} input`).focus();
			}
		}
		// wait for response
		return await new Promise(resolve => {
			const interval = setInterval(() => {
				if (typeof dialog.response === "undefined") {
					return;
				}
				clearInterval(interval);
				if (dialog.response !== null) {
					overlay.hide("dialog");
				}
				resolve(dialog.response);
			}, 25);
		});
	},
	// react to click event
	//   button = element
	button (button) {
		dialog.response = button.dataset.response === "true" ? true : false;
		overlay.hide("dialog");
	},
};

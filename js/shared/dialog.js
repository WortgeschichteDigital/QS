"use strict";

const dialog = {
  // user response to the currently shown dialog
  //   undefined = initial state
  //   null = dialog was canceled (close icon or Escape key)
  //   true = button with value true pressed
  //   false = button with value false pressed
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
    t.replaceChildren();
    for (const i of text.split("\n")) {
      const p = document.createElement("p");
      t.appendChild(p);
      p.innerHTML = i;
    }
    // print password field if requested
    if (type === "pass") {
      const p = document.createElement("p");
      t.appendChild(p);
      const input = document.createElement("input");
      p.appendChild(input);
      input.type = "password";
      input.value = "";
      input.placeholder = "Passwort";
      input.addEventListener("keydown", function (evt) {
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
    } else if (wait) {
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
    // wait for response
    const response = await new Promise(resolve => {
      const interval = setInterval(async () => {
        if (typeof dialog.response === "undefined") {
          return;
        }
        clearInterval(interval);
        if (dialog.response !== null) {
          await overlay.hide("dialog");
        }
        resolve(dialog.response);
      }, 25);
    });
    return response;
  },
};

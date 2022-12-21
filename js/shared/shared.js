"use strict";

const shared = {
  // app info
  //   appPath = string (path to app root folder)
  //   documents = string (path to user documents dir)
  //   packaged = boolean (app is packaged)
  //   temp = string (path to temp dir)
  //   userData = string (path to config dir)
  //   version = string (app version)
  //   winId = integer (window ID)
  info: {},

  // Electron modules
  // (this file is also included in workers, but in that context,
  // require() isn't available => check whether window exists or not)
  clipboard: typeof window !== "undefined" ? require("electron").clipboard : null,
  ipc: typeof window !== "undefined" ? require("electron").ipcRenderer : null,
  shell: typeof window !== "undefined" ? require("electron").shell : null,

  // Node.js modules
  exec: typeof window !== "undefined" ? require("child_process").exec : null,
  crypto: typeof window !== "undefined" ? require("crypto") : null,
  fsp: typeof window !== "undefined" ? require("fs").promises : null,
  path: typeof window !== "undefined" ? require("path") : null,

  // clear text of homograph or field article markers
  //   text = string
  hClear (text) {
    return text.replace(/ \(.+?\)$/, "");
  },

  // detect pressed modifiers
  //   evt = object (keydown event)
  detectKeyboardModifiers (evt) {
    const m = [];
    if (evt.altKey) {
      m.push("Alt");
    }
    if (evt.getModifierState("AltGraph")) {
      m.push("AltGr");
    }
    if (evt.getModifierState("CapsLock")) {
      m.push("Caps");
    }
    if (evt.ctrlKey) {
      m.push("Ctrl");
    }
    if (evt.metaKey) {
      if (process.platform === "darwin") {
        // in macOS, it is more convenient when the meta key acts
        // the same as the control key
        m.push("Ctrl");
      } else {
        m.push("Meta");
      }
    }
    if (evt.shiftKey) {
      m.push("Shift");
    }
    return m.join("+");
  },

  // error: display error message
  //   err = string
  async error (err) {
    const error = shared.errorString(err);
    await dialog.open({
      type: "alert",
      text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${error}`,
    });
  },

  // error: reduce the error stack
  //   err = string
  errorReduceStack (err) {
    const stack = [];
    for (const m of err.matchAll(/[a-zA-Z]+\.js:[0-9]+/g)) {
      stack.unshift(m[0]);
    }
    return stack.join("\u00A0> ");
  },

  // error: prepare error strings for better readability
  //   err = string
  errorString (err) {
    let error = err.replace(/\n/g, "<br>");
    error = error.replace(/(?<!<)[/\\]/g, m => `${m}<wbr>`);
    return error;
  },

  // error: log errors
  //   evt = object
  errorLog (evt) {
    // evt.filename marks a normal error
    let { filename } = evt;
    let { message } = evt;
    let { lineno } = evt;
    let { colno } = evt;
    let stack = "";
    // forwarded errors
    if (evt.stack) {
      if (!/file:.+?\.js/.test(evt.stack)) {
        noDetails();
      } else {
        [ filename ] = evt.stack.match(/file:.+?\.js/);
        message = `${evt.name}: ${evt.message}`;
        lineno = parseInt(evt.stack.match(/\.js:([0-9]+):/)[1], 10);
        colno = parseInt(evt.stack.match(/\.js:[0-9]+:([0-9]+)/)[1], 10);
        stack = shared.errorReduceStack(evt.stack);
      }
    // in promise errors
    } else if (evt.reason) {
      if (!/file:.+?\.js/.test(evt.reason.stack)) {
        noDetails();
      } else {
        [ filename ] = evt.reason.stack.match(/file:.+?\.js/);
        message = evt.reason.stack.match(/(.+?)\n/)[1];
        lineno = parseInt(evt.reason.stack.match(/\.js:([0-9]+):/)[1], 10);
        colno = parseInt(evt.reason.stack.match(/\.js:[0-9]+:([0-9]+)/)[1], 10);
        stack = shared.errorReduceStack(evt.reason.stack);
      }
    }
    // create error and send to main
    let err = `\n----- ${new Date().toISOString()} -----\n`;
    if (filename || lineno || colno) {
      err += `${filename}: ${lineno}:${colno}\n`;
    }
    err += message + "\n";
    if (stack) {
      err += `(${stack})\n`;
    }
    shared.ipc.invoke("error", err);
    // no details avaiblable
    function noDetails () {
      let stack = evt.reason.stack ? evt.reason.stack : "";
      if (!stack && evt.reason.name) {
        stack = `${evt.reason.name}: ${evt.reason.message}`;
      }
      filename = "";
      message = stack;
      lineno = 0;
      colno = 0;
    }
  },

  // escape special RegExp tokens
  escapeRegExp (text) {
    return text.replace(/\/|\(|\)|\[|\]|\{|\}|\.|\?|\\|\+|\*|\^|\$|\|/g, m => `\\${m}`);
  },

  // open links in external program
  externalLinks () {
    document.querySelectorAll('a[href^="https:"], a[href^="mailto:"]').forEach(i => {
      i.addEventListener("click", function (evt) {
        evt.preventDefault();
        // prevent double-clicks
        if (evt.detail > 1) {
          return;
        }
        shared.shell.openExternal(this.getAttribute("href"));
      });
    });
  },

  // show passive feedback
  //   type = string (copied | error | okay | reached-bottom | reached-left |
  //     reached-right | reached-top)
  async feedback (type) {
    const fb = document.createElement("div");
    fb.classList.add("feedback", "type-" + type);
    document.body.appendChild(fb);
    void fb.offsetWidth;
    fb.classList.add("visible");
    await shared.wait(1300);
    fb.addEventListener("transitionend", function () {
      this.parentNode.removeChild(this);
    }, { once: true });
    fb.classList.remove("visible");
  },

  // fetch data
  //   url = string
  async fetch (url) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1e4);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
      });
    } catch (err) {
      return {
        ok: false,
        err,
        text: "",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        err: {
          name: "Server-Fehler",
          message: `HTTP-Status-Code ${response.status}`,
        },
        text: "",
      };
    }
    const text = await response.text();
    return {
      ok: true,
      err: {},
      text,
    };
  },

  // highlight a results block
  //   block = node
  async highlightBlock (block) {
    await shared.scrollEnd();
    block.addEventListener("animationend", function () {
      this.classList.remove("highlight-block");
    }, { once: true });
    block.classList.add("highlight-block");
  },

  // change titles with keyboard shortcuts if on macOS
  keyboardMacOS () {
    if (process.platform !== "darwin") {
      return;
    }
    const sc = {
      Alt: "⌥",
      Strg: "⌘",
    };
    // <kbd>
    document.querySelectorAll("kbd").forEach(i => {
      const text = i.textContent;
      if (!/^(Alt|Strg)$/.test(text)) {
        return;
      }
      i.textContent = sc[text];
    });
    // @title
    document.querySelectorAll("[title]").forEach(i => {
      i.title = i.title.replace(/Alt\s\+/, sc.Alt + "\u00A0+");
      i.title = i.title.replace(/Strg\s\+/, sc.Strg + "\u00A0+");
    });
  },

  // navigate through a vertical navigation
  //   nav = node
  //   up = boolean
  verticalNav (nav, up) {
    const active = nav.querySelector(".active");
    let target;
    if (up) {
      target = active.parentNode.previousSibling;
    } else {
      target = active.parentNode.nextSibling;
    }
    if (!target) {
      return;
    }
    target.firstChild.click();
  },

  // detect scroll end
  //   obj = node (scrollable element)
  async scrollEnd (obj = window) {
    await new Promise(resolve => {
      let scroll = false;
      let scrollTimer;
      function scrollDetect () {
        scroll = true;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => scrollEnd(), 25);
      }
      function scrollEnd () {
        obj.removeEventListener("scroll", scrollDetect);
        resolve(true);
      }
      obj.addEventListener("scroll", scrollDetect);
      setTimeout(() => {
        if (!scroll) {
          scrollEnd();
        }
      }, 50);
    });
  },

  // sort alpha-numeric
  sort (a, b) {
    const x = shared.sortPrep(a);
    const y = shared.sortPrep(b);
    let z = [ x, y ];
    if (x === y) {
      if (a === b) {
        return 0;
      }
      z = [ a, b ];
    }
    z.sort();
    if (z[0] === x ||
        z[0] === a) {
      return -1;
    }
    return 1;
  },

  // cache with prepared strings
  sortPrepCache: {},

  // prepare strings for alpha-numeric sorting
  sortPrep (str) {
    if (shared.sortPrepCache[str]) {
      return shared.sortPrepCache[str];
    }
    let norm = str.toLowerCase();
    const rep = new Map([
      [ /ä/g, "ae" ],
      [ /[èé]/g, "e" ],
      [ /ö/g, "oe" ],
      [ /ü/g, "ue" ],
      [ /ß/g, "ss" ],
    ]);
    for (const [ k, v ] of rep) {
      norm = norm.replace(k, v);
    }
    shared.sortPrepCache[str] = norm;
    return norm;
  },

  // wait for the given milliseconds
  //   ms = integer
  async wait (ms) {
    await new Promise(resolve => setTimeout(() => resolve(true), ms));
  },

  // color-code XML
  //   text = string
  //   commentCompletion = false | undefined
  xmlColorCode (text, commentCompletion = true) {
    let t = text;
    // complete comments
    // (as comments are often cut in half they should be completed
    // at the beginning or at the end respectively)
    if (commentCompletion) {
      const open = /&lt;!--/.exec(t)?.index ?? -1;
      const close = /--&gt;/.exec(t)?.index ?? -1;
      if (open >= 0 && close.length === -1 ||
          open >= 0 && close >= 0 && open > close) {
        t += " --&gt;";
      }
      if (open === -1 && close >= 0 ||
          open >= 0 && close >= 0 && close < open) {
        t = "&lt;!-- " + t;
      }
    }
    // highlight tags
    t = t.replace(/&lt;!--.+?--&gt;/gs, m => `<span class="xml-comment">${m}</span>`);
    t = t.replace(/&lt;[^!].+?&gt;/g, m => `<span class="xml-tag">${m}</span>`);
    t = t.replace(/<span class="xml-tag">(.+?)<\/span>/g, (m, p1) => {
      const paren = p1.replace(/ ([^\s]+?=)(&quot;.+?&quot;)/g, (m, p1, p2) => ` <span class="xml-attr-key">${p1}</span><span class="xml-attr-val">${p2}</span>`);
      return `<span class="xml-tag">${paren}</span>`;
    });
    return t;
  },
};

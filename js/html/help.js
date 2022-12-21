"use strict";

const help = {
  // initialize view
  init () {
    // prepare navigation and sections
    document.querySelector("nav a").classList.add("active");
    document.querySelectorAll("section").forEach((i, n) => {
      if (n === 0) {
        return;
      }
      i.classList.add("off");
    });
    // color code XML
    document.querySelectorAll("code, pre").forEach(i => {
      let code = shared.xmlColorCode(i.innerHTML, false);
      code = code.replace(/(@[a-zA-Z:_]+=?)(".+?")?/g, (m, p1, p2) => {
        if (!p2) {
          return `<span class="xml-attr-key">${m}</span>`;
        }
        return `<span class="xml-attr-key">${p1}</span><span class="xml-attr-val">${p2}</span>`;
      });
      i.innerHTML = code;
    });
    // include table of contents icon
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = "#";
    a.id = "toc";
    a.title = "Inhaltsverzeichnis";
    const img = document.createElement("img");
    a.appendChild(img);
    img.src = "../img/win/toc.svg";
    img.width = "48";
    img.height = "48";
    img.alt = "";
    a.addEventListener("click", function (evt) {
      evt.preventDefault();
      if (document.querySelector(".toc-popup")) {
        help.tocClose();
      } else {
        help.tocOpen();
      }
    });
  },

  // show table of contents
  tocOpen () {
    document.querySelector("#toc").dispatchEvent(new Event("mouseout"));
    const toc = document.createElement("div");
    document.body.appendChild(toc);
    toc.classList.add("toc-popup");
    // fill in headings
    const section = document.querySelector("nav a.active").getAttribute("href");
    for (const i of document.querySelector(section).children) {
      if (!/^H[0-6]$/.test(i.nodeName)) {
        continue;
      }
      const a = document.createElement("a");
      toc.appendChild(a);
      a.classList.add("level-" + i.nodeName.match(/[0-6]$/)[0]);
      a.href = "#" + i.nextElementSibling.id;
      a.textContent = i.textContent;
      a.addEventListener("click", () => {
        help.historyAdd();
        help.tocClose();
      });
    }
    // show popup
    void toc.offsetWidth;
    toc.classList.add("visible");
  },

  // close table of contents
  tocClose () {
    const toc = document.querySelector(".toc-popup");
    if (!toc || !toc.classList.contains("visible")) {
      return;
    }
    toc.addEventListener("transitionend", function () {
      this.parentNode.removeChild(this);
    }, { once: true });
    toc.classList.remove("visible");
  },

  // navigation history
  history: {
    data: [],
    idx: -1,
  },

  // add entry to history
  //   hash = string
  historyAdd () {
    const { history: h } = help;
    if (h.idx >= 0) {
      h.data.splice(h.idx, h.data.length - h.idx);
    }
    h.data.push({
      section: document.querySelector("nav a.active").getAttribute("href").substring(1),
      y: window.scrollY,
    });
    h.idx = h.data.length;
  },

  // move through history
  //   backwards = boolean
  historyNav (backwards) {
    // detect direction and position
    const h = help.history;
    let { idx } = h;
    if (backwards) {
      idx--;
    } else {
      idx++;
    }
    if (idx <= -1 || idx >= h.data.length) {
      if (backwards) {
        shared.feedback("reached-left");
      } else {
        shared.feedback("reached-right");
      }
      return;
    }
    // add new entry in case this is the first move backwards
    const entry = h.data[idx];
    const section = document.querySelector("nav a.active").getAttribute("href").substring(1);
    if (backwards &&
        h.idx === h.data.length &&
        (entry.section !== section ||
        entry.y !== window.scrollY)) {
      h.data.push({
        section,
        y: window.scrollY,
      });
    }
    h.idx = idx;
    // navigate
    if (entry.section !== section) {
      help.switchSection(entry.section, false);
    }
    window.scrollTo({
      top: entry.y,
      left: 0,
      behavior: "smooth",
    });
  },

  // navigation with internal links
  //   hash = string
  internalLink (hash) {
    help.historyAdd();
    const [ section ] = hash.substring(1).split("-");
    if (document.querySelector(`#${section}.off`)) {
      help.switchSection(section, false);
    }
    if (hash.includes("-")) {
      window.location.hash = hash;
    }
  },

  // navigate to the given section
  //   sect = string (section ID)
  //   recordHistory = false | undefined
  switchSection (sect, recordHistory = true) {
    if (recordHistory) {
      help.historyAdd();
    }
    help.tocClose();
    // update navigation
    const active = document.querySelector("nav .active");
    if (active.getAttribute("href").substring(1) === sect) {
      return;
    }
    active.classList.remove("active");
    document.querySelector(`nav a[href="#${sect}"]`).classList.add("active");
    // update section view
    document.querySelectorAll("section").forEach(i => {
      if (i.id === sect) {
        i.classList.remove("off");
      } else {
        i.classList.add("off");
      }
    });
    // scroll to top
    window.scrollTo(0, 0);
  },

  // show a specific section
  //   data = object
  show (data) {
    document.querySelector(`nav a[href="#${data.section}"]`).click();
    help.internalLink(`#${data.section}-${data.id}`);
  },
};

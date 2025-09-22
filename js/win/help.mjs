
import shared from "../shared.mjs";

export { help as default };

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
    document.querySelectorAll("code, pre:not(.no-highlight)").forEach(i => {
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
    img.src = "../img/toc.svg";
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

  // initialise handling of internal links
  //   scope = node | undefined
  initInternalLinks (scope = document) {
    scope.querySelectorAll('section a[href^="#"]').forEach(i => {
      i.addEventListener("click", function (evt) {
        evt.preventDefault();
        help.internalLink(this.getAttribute("href"));
      });
    });
  },

  // show table of contents
  tocOpen () {
    document.getElementById("toc").dispatchEvent(new Event("mouseout"));
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
        (entry.section !== section || entry.y !== window.scrollY)) {
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
      window.location.hash = "";
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

  // search data
  searchData: {
    // last search was a global search
    glob: false,
    // last mark number (zero based)
    idx: -1,
    // last scroll position
    scroll: -1,
    // last search text
    text: "",
  },

  // search: start or continue search
  //   forward = boolean
  search (forward) {
    const { searchData: data } = help;

    // prepare bar
    const bar = document.getElementById("search-bar");
    if (bar.classList.contains("invisible")) {
      help.searchToggle(true);
    }

    // get text
    const field = document.getElementById("search-field");
    const glob = document.getElementById("search-global").checked;
    const resultsCont = document.getElementById("search-results");
    let text = field.value.trim();
    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!text) {
      field.classList.remove("no-results");
      resultsCont.textContent = "";
      return;
    }
    if (data.glob === glob &&
        data.text === text) {
      help.searchJump(forward);
      return;
    }
    data.glob = glob;
    data.idx = -1;
    data.scroll = -1;
    data.text = text;

    // make RegExp
    let regText = shared.escapeRegExp(text[0]);
    for (let i = 1, len = text.length; i < len; i++) {
      regText += "(<[^>]+>)*";
      regText += shared.escapeRegExp(text[i]);
    }
    regText = regText.replace(/\s/g, "(&nbsp;|\\s)");
    const reg = new RegExp(regText, "gi");
    const regClean = /(<[^>]*?)<mark class="search.*?">(.+?)<\/mark>/g;

    // perform search
    help.searchReset(true);
    const sections = glob ? "section" : "section:not(.off)";
    const selectors = [
      `${sections} > h1`,
      `${sections} > h2`,
      `${sections} > ol > li`,
      `${sections} > div > ol > li`,
      `${sections} > p`,
      `${sections} > div > p`,
      `${sections} > pre`,
      `${sections} > div > pre`,
      `${sections} tr`,
      `${sections} > ul > li`,
      `${sections} > div > ul > li`,
    ];
    let results = 0;
    document.querySelectorAll(selectors.join(", ")).forEach(e => {
      let html = e.innerHTML;
      if (reg.test(html)) {
        html = html.replace(reg, (...args) => {
          // prepare match
          let [ m ] = args;
          if (/<.+?>/.test(m)) {
            m = m.replace(/<.+?>/g, m => `</mark>${m}<mark class="search">`);
          }

          // remove empty <mark> tags
          // (this might happen if tags are nested)
          m = m.replace(/<mark class="search"><\/mark>/g, "");

          // concat return value
          m = `<mark class="search">${m}</mark>`;

          // detect <mark> tags that aren't at the beginning or the end
          if (m.match(/class="search"/g).length > 1) {
            const splitted = m.split(/class="search"/);
            m = "";
            for (let i = 0, len = splitted.length; i < len; i++) {
              if (i === 0) {
                m += splitted[i] + 'class="search search-no-end"';
              } else if (i === len - 2) {
                m += splitted[i] + 'class="search search-no-start"';
              } else if (i < len - 1) {
                m += splitted[i] + 'class="search search-no-start search-no-end"';
              } else {
                m += splitted[i];
              }
            }
          }

          // return match with marks
          return m;
        });

        // clean up nested tags
        while (regClean.test(html)) {
          html = html.replace(regClean, (...args) => args[1] + args[2]);
          regClean.lastIndex = -1;
        }

        // insert HTML with <mark> tags
        e.innerHTML = html;
        help.initInternalLinks(e);
        results += e.querySelectorAll("mark.search:not(.search-no-start)").length;
      }
    });

    // update search field color and results
    if (!results) {
      data.text = "";
      field.classList.add("no-results");
      field.select();
      resultsCont.textContent = "";
      return;
    }
    field.classList.remove("no-results");
    resultsCont.textContent = `(${shared.bigNumber(results)} Treffer)`;

    // jump to next result
    help.searchJump(forward);
  },

  // jump to next result
  //   forward = boolean
  async searchJump (forward) {
    const { searchData: data } = help;

    // detect relevant sections
    const currentSect = document.querySelector("section:not(.off)");
    let marks = currentSect.querySelectorAll("mark.search");
    let sect = [];
    let currentSectIdx = -1;
    if (data.glob || !marks.length) {
      sect = document.querySelectorAll("section");
      for (let i = 0, len = sect.length; i < len; i++) {
        if (sect[i] === currentSect) {
          currentSectIdx = i;
        }
      }
    } else {
      sect.push(currentSect);
      currentSectIdx = 0;
    }

    // detect next mark in current section
    let idx;
    if (forward &&
        data.idx >= 0 &&
        window.scrollY === data.scroll) {
      idx = data.idx + 1;
    } else if (!forward &&
        data.idx >= 0 &&
        window.scrollY === data.scroll) {
      idx = data.idx - 1;
    } else {
      let visibleMark = -1;
      for (let i = 0, len = marks.length; i < len; i++) {
        const { top } = marks[i].getBoundingClientRect();
        if (top >= 60) {
          visibleMark = i;
          break;
        }
      }
      if (forward) {
        idx = visibleMark;
      } else {
        idx = --visibleMark;
      }
    }

    // switch section if necessary
    if (idx < 0 || idx >= marks.length) {
      // detect section to switch to
      let newSectIdx = currentSectIdx;
      if (forward) {
        // detect next sections with marks
        do {
          newSectIdx++;
          if (newSectIdx === sect.length) {
            newSectIdx = 0;
          }
          marks = sect[newSectIdx].querySelectorAll("mark.search");
        } while (!marks.length);
        // next mark to show
        idx = 0;
      } else {
        // detect previous section with marks
        do {
          newSectIdx--;
          if (newSectIdx === -1) {
            newSectIdx = sect.length - 1;
          }
          marks = sect[newSectIdx].querySelectorAll("mark.search");
        } while (!marks.length);
        // next mark to show
        idx = marks.length - 1;
      }
      // switch section if necessary
      if (newSectIdx !== currentSectIdx) {
        help.switchSection(sect[newSectIdx].id);
      }
    }
    data.idx = idx;

    // scroll to next mark
    let scrollTarget = marks[idx];
    if (marks[idx].closest("h1, h2")) {
      scrollTarget = marks[idx].closest("h1, h2").nextElementSibling;
    }
    const barTop = document.getElementById("search-bar").getBoundingClientRect().top;
    const targetRect = scrollTarget.getBoundingClientRect();
    if (targetRect.bottom + 10 > barTop ||
        targetRect.top < 62) {
      window.scrollTo({
        // add 2 * 60px for heading height and two text lines
        top: window.scrollY + targetRect.top - 2 * 60,
        left: 0,
        behavior: "smooth",
      });
      await shared.scrollEnd();
    }
    data.scroll = window.scrollY;

    // highlight next mark
    resetHighlight(marks[idx]);
    marks[idx].classList.add("highlight");
    while (marks[idx].classList.contains("search-no-end")) {
      data.idx = ++idx;
      resetHighlight(marks[idx]);
      marks[idx].classList.add("highlight");
    }
    function resetHighlight (mark) {
      mark.addEventListener("transitionend", function () {
        this.classList.remove("highlight");
      }, { once: true });
    }
  },

  // remove all search results
  //   onlyMarks = boolean
  searchReset (onlyMarks) {
    // reset data and search field
    if (!onlyMarks) {
      help.searchData.idx = -1;
      help.searchData.scroll = -1;
      help.searchData.text = "";
      const field = document.getElementById("search-field");
      field.value = "";
      field.classList.remove("no-results");
      document.getElementById("search-results").textContent = "";
    }

    // reset marks
    document.querySelectorAll("mark.search").forEach(i => {
      const parent = i.parentNode;
      if (!parent) {
        return;
      }
      const html = parent.innerHTML.replace(/<mark class="search.*?">(.+?)<\/mark>/g, (...args) => args[1]);
      parent.innerHTML = html;
      help.initInternalLinks(parent);
    });
  },

  // search: toggle search bar
  //   open = boolean
  searchToggle (open) {
    const bar = document.getElementById("search-bar");
    const field = document.getElementById("search-field");
    if (open && bar.classList.contains("invisible")) {
      bar.classList.remove("invisible");
      document.body.classList.add("search-bar-open");
      field.select();
    } else if (!open) {
      help.searchReset(false);
      bar.classList.add("invisible");
      document.body.classList.remove("search-bar-open");
      document.activeElement.blur();
    } else {
      field.select();
    }
  },
};

"use strict";

const viewSearch = {
  // intersection observer for search results
  // (the last result is observed if there are more to display)
  observer: new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }
      viewSearch.printMoreResults();
    });
  }),

  // let's have a worker, as the search can be pretty expensive
  worker: null,

  // data for the current search
  data: {
    // regExp is filled with objects:
    //   high = regular expression for highlighting the results
    //   search = regular expression for searching the text
    //   termN = zero-based term number (in the order they appear in the results bar)
    //   text = search text (used for sorting the expressions by length)
    //   textOri = search term as it was typed
    regExp: [],
    results: [],
    resultsFiles: new Set(),
    resultsFilesPrinted: new Set(),
    // starting a new search is blocked
    running: false,
    // determines whether the worker has finished or not
    searching: false,
    stripTags: false,
  },

  // start search
  async start () {
    const statsStart = new Date();
    const searchText = document.querySelector("#search-text");
    if (viewSearch.data.running) {
      await dialog.open({
        type: "alert",
        text: "Die vorherige Suche läuft noch.",
      });
      searchText.select();
      return;
    }
    viewSearch.data.running = true;
    // split up search term
    const textOri = searchText.value.trim();
    let text = textOri;
    if (!text) {
      await shared.wait(25);
      await dialog.open({
        type: "alert",
        text: "Sie haben keinen Suchtext eingegeben.",
      });
      finishUp(false);
      return;
    }
    if (document.querySelector("#search-always-xml").checked) {
      viewSearch.data.stripTags = false;
    } else {
      viewSearch.data.stripTags = !/[<>]/.test(text);
    }
    const search = [];
    // regular expressions
    for (const i of text.matchAll(/\/(.+?)\/(i)?/g)) {
      search.push({
        isInsensitive: typeof i[2] !== "undefined",
        isRegExp: true,
        text: i[1].replace(/\((?!\?)/g, () => "(?:"),
        textOri: i[0],
        textOriIdx: -1,
      });
      text = text.replace(i[0], "");
    }
    text = text.trim();
    // phrases
    for (const i of text.matchAll(/'(.+?)'|"(.+?)"/g)) {
      search.push({
        isInsensitive: !/[A-ZÄÖÜ]/.test(i[1] || i[2]),
        isRegExp: false,
        text: i[1] || i[2],
        textOri: i[0],
        textOriIdx: -1,
      });
      text = text.replace(i[0], "");
    }
    text = text.trim();
    // single search words
    for (let i of text.split(" ")) {
      i = i.trim();
      if (!i) {
        continue;
      }
      search.push({
        isInsensitive: !/[A-ZÄÖÜ]/.test(i),
        isRegExp: false,
        text: i,
        textOri: i,
        textOriIdx: -1,
      });
    }
    // sort search terms by position in the search expression
    for (const i of search) {
      const reg = new RegExp(shared.escapeRegExp(i.textOri), "g");
      i.textOriIdx = reg.exec(textOri).index;
    }
    search.sort((a, b) => a.textOriIdx - b.textOriIdx);
    // create regular expressions
    viewSearch.data.regExp.length = 0;
    for (let i = 0, len = search.length; i < len; i++) {
      const item = search[i];
      const text = item.isRegExp ? item.text : shared.escapeRegExp(item.text);
      const flags = item.isInsensitive ? "gi" : "g";
      let reg;
      let regHigh;
      try {
        reg = new RegExp(addVariants(text), flags);
        if (!viewSearch.data.stripTags && !item.isRegExp) {
          let textHigh = "";
          for (let i = 0, len = text.length; i < len; i++) {
            if (i > 0 && i < len - 1) {
              textHigh += "(<[^>]+>)*";
            }
            textHigh += text[i];
          }
          textHigh = maskSpecialTokens(textHigh);
          regHigh = new RegExp(addVariants(textHigh), flags);
        } else {
          regHigh = reg;
        }
      } catch (err) {
        await shared.wait(25);
        await shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
        searchText.select();
        finishUp(false);
        return;
      }
      viewSearch.data.regExp.push({
        high: regHigh,
        search: reg,
        termN: i,
        text: item.text,
        textOri: item.textOri,
      });
    }
    viewSearch.data.regExp.sort((a, b) => b.text.length - a.text.length);
    function addVariants (text) {
      const variants = new Map([
        // the following pair is no variant
        [ /&(?!([gl]t|quot);)/g, "&amp;" ],
        [ /s/g, "[sſ]" ],
        [ /ß/g, "(ß|ss)" ],
        // For the following pairs, round brackets are mandatory!
        [ /ä/g, "(ä|aͤ)" ],
        [ /ö/g, "(ö|oͤ)" ],
        [ /ü/g, "(ü|uͤ)" ],
      ]);
      let t = text;
      for (const [ k, v ] of variants) {
        t = t.replace(k, v);
      }
      return t;
    }
    function maskSpecialTokens (text) {
      const tokens = new Map([
        [ /"/g, "&quot;" ],
        [ /(?<!\()</g, "&lt;" ],
        [ />(?![\])])/g, "&gt;" ],
      ]);
      let t = text;
      for (const [ k, v ] of tokens) {
        t = t.replace(k, v);
      }
      return t;
    }
    // search XML files
    window.scrollTo(0, 0);
    await viewSearch.toggleAdvanced("off");
    await viewSearch.searchXml();
    viewSearch.data.results.forEach(i => viewSearch.data.resultsFiles.add(i.file));
    viewSearch.data.resultsFilesPrinted.clear();
    // print results
    viewSearch.printResults();
    // handle results bar
    bars.resultsSearch();
    // finish up
    finishUp(true);
    function finishUp (feedback) {
      searchText.select();
      viewSearch.data.running = false;
      if (feedback && win.view !== "search") {
        if (viewSearch.data.results.length) {
          shared.feedback("okay");
        } else {
          shared.feedback("error");
        }
      }
      prefs.stats("search", statsStart);
    }
  },

  // perform search in XML files
  searchXml () {
    viewSearch.data.searching = true;
    // please hold the line
    const res = document.querySelector("#search");
    res.replaceChildren();
    res.appendChild(win.pleaseWait());
    // load worker if necessary
    if (!viewSearch.worker) {
      viewSearch.worker = new Worker("js/win/workerSearch.js");
      viewSearch.worker.addEventListener("message", evt => {
        viewSearch.data.results = evt.data;
        viewSearch.data.searching = false;
      });
    }
    // get filters and determine search scope
    const dataF = bars.filtersGetData();
    dataF["select-status"] = parseInt(dataF["select-status"], 10);
    const dataA = viewSearch.getAdvancedData();
    const scopes = {
      "search-scope-1": [ "Wortgeschichte_kompakt", "Wortgeschichte(?!_)" ],
      "search-scope-2": [ "Belegreihe" ],
      "search-scope-3": [ "Lesarten" ],
      "search-scope-4": [ "Verweise" ],
    };
    const scope = [];
    for (const [ id, checked ] of Object.entries(dataA)) {
      if (!scopes[id] || !checked) {
        continue;
      }
      scopes[id].forEach(s => scope.push(s));
    }
    // post data to worker
    const narrowSearch = document.querySelector("#search-narrow");
    const regExp = [];
    for (const i of viewSearch.data.regExp) {
      regExp.push(i.search);
    }
    viewSearch.worker.postMessage({
      filters: dataF,
      narrowSearch: narrowSearch.checked ? viewSearch.data.resultsFiles : new Set(),
      regExp,
      sameLine: document.querySelector("#search-same-line").checked,
      scope,
      stripTags: viewSearch.data.stripTags,
      xmlData: xml.data.files,
      xmlFiles: xml.files,
    });
    narrowSearch.checked = false;
    viewSearch.toggleAdvancedIcon();
    // reset results objects
    viewSearch.data.results.length = 0;
    viewSearch.data.resultsFiles.clear();
    // wait until the worker has finished
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (!viewSearch.data.searching) {
          clearInterval(interval);
          resolve(true);
        }
      }, 250);
    });
  },

  // prepare printing of results
  printResults () {
    const res = document.querySelector("#search");
    res.replaceChildren();
    // no results
    if (!viewSearch.data.results.length) {
      res.appendChild(win.nothingToShow());
      return;
    // too much results
    } else if (viewSearch.data.results.length > 5e3) {
      viewSearch.data.results.length = 0;
      const div = win.nothingToShow("Zu viele Treffer!", "Tipp: Schränken Sie Ihre Suche weiter ein.");
      res.appendChild(div);
      return;
    }
    // print results
    viewSearch.printMoreResults();
  },

  // print the next chunk of results
  printMoreResults () {
    const res = document.querySelector("#search");
    // remove last result from intersection observer entries
    if (res.lastChild) {
      viewSearch.observer.unobserve(res.lastChild);
    }
    // prepare printing
    const { resultsFilesPrinted } = viewSearch.data;
    let start = 0;
    for (let i = 0, len = viewSearch.data.results.length; i < len; i++) {
      if (!resultsFilesPrinted.has(viewSearch.data.results[i].file)) {
        start = i;
        break;
      }
    }
    let lastFile = "";
    // print next 50 results
    for (let f = start, len = viewSearch.data.results.length; f < len; f++) {
      const i = viewSearch.data.results[f];
      // heading
      if (i.file !== lastFile) {
        if (f - start + 1 >= 50) {
          break;
        }
        resultsFilesPrinted.add(i.file);
        // create heading
        res.appendChild(win.makeListHeading(i.file));
        // update variables
        lastFile = i.file;
      }
      // result item
      const div = document.createElement("div");
      res.appendChild(div);
      div.classList.add("search-result");
      const line = document.createElement("span");
      div.appendChild(line);
      line.innerHTML = `Zeile <b>${i.line}</b>`;
      // print text
      let text = "";
      if (i.textBefore) {
        text = i.textBefore + " ";
      }
      text += i.text;
      if (i.textAfter) {
        text += " " + i.textAfter;
      }
      text = viewSearch.textMaskChars(text);
      let ele;
      let highlight;
      if (viewSearch.data.stripTags) {
        ele = document.createElement("p");
        highlight = viewSearch.textHighlight(text);
      } else {
        ele = document.createElement("code");
        text = shared.xmlColorCode(text);
        highlight = viewSearch.textHighlight(text);
      }
      div.dataset.matched = highlight.matched.join(",");
      ({ text } = highlight);
      text = viewSearch.textWbr(text);
      ele.innerHTML = text;
      div.appendChild(ele);
    }
    // initialize tooltips
    tooltip.init(res);
    // let's have some doomscrolling
    if (resultsFilesPrinted.size !== viewSearch.data.resultsFiles.size) {
      viewSearch.observer.observe(res.lastChild);
    }
  },

  // mask special characters
  //   text = string
  textMaskChars (text) {
    const chars = new Map([
      [ /&(?!amp;)/g, "&amp;" ],
      [ /</g, "&lt;" ],
      [ />/g, "&gt;" ],
      [ /"/g, "&quot;" ],
      [ /'/g, "&apos;" ],
    ]);
    let t = text;
    for (const [ k, v ] of chars) {
      t = t.replace(k, v);
    }
    return t;
  },

  // highlight search results
  //   text = string
  //   regExp = array
  textHighlight (text, regExp = viewSearch.data.regExp) {
    const matched = new Set();
    let t = text;
    for (let i = 0, len = regExp.length; i < len; i++) {
      const item = regExp[i];
      const reg = viewSearch.data.stripTags ? item.search || item.high : item.high;
      const { termN } = item;
      const color = termN % 6 + 1;
      t = t.replace(reg, match => {
        let m = match;
        matched.add(termN);
        // highlighing across tag boundaries
        if (/[<>]/.test(m)) {
          let n = 0;
          m = m.replace(/<.+?>/g, match => {
            n++;
            return `</mark>${match}<mark class="color${color} ${n}">`;
          });
          m = `<mark class="color${color} 0">${m}</mark>`;
          m = m.replace(/(<\/.+?>)(<\/.+?>)/g, (match, p1, p2) => {
            if (p2 === "</mark>") {
              return p1;
            }
            return match;
          });
          for (let i = 0; i <= n; i++) {
            const reg = new RegExp(` ${i}"`);
            if (i === 0) {
              m = m.replace(reg, ' no-end"');
            } else if (i === n) {
              m = m.replace(reg, ' no-start"');
            } else {
              m = m.replace(reg, ' no-start no-end"');
            }
          }
          return m;
        }
        // no tag boundaries
        return `<mark class="color${color}">${m}</mark>`;
      });
    }
    const clean = /(<[^>]*?)<mark class="color[0-9]">(.+?)<\/mark>/g;
    while (clean.test(t)) {
      t = t.replace(clean, (m, p1, p2) => p1 + p2);
      clean.lastIndex = -1;
    }
    return {
      matched: [ ...matched ].sort((a, b) => a - b),
      text: t,
    };
  },

  // insert <wbr> at certain positions
  //   text = string
  textWbr (text) {
    let t = text.replace(/[%_]/g, m => `<wbr>${m}`);
    t = t.replace(/&amp;/g, "&amp;<wbr>");
    t = t.replace(/(?<!&amp;|&lt;|<)\//g, "/<wbr>");
    return t;
  },

  // read checkboxes in advanced search options
  getAdvancedData () {
    const advanced = {};
    document.querySelectorAll("#search-advanced input").forEach(i => {
      advanced[i.id] = i.checked;
    });
    return advanced;
  },

  // toggle advanced search options
  //   force = "on" | "off" | undefined
  async toggleAdvanced (force = "") {
    const a = document.querySelector("#search-advanced");
    // 10px padding-top #search-form
    const maxHeight = a.offsetTop + a.offsetHeight + 10;
    const bar = document.querySelector("#bar");
    const barHeight = bar.offsetHeight;
    if ((!force || force === "on") && barHeight < maxHeight) {
      // toggle on
      bar.style.height = "60px";
      void bar.offsetHeight;
      bar.style.height = maxHeight + "px";
      await new Promise(end => {
        bar.addEventListener("transitionend", () => {
          end(true);
        }, { once: true });
      });
    } else if ((!force || force === "off") && barHeight === maxHeight) {
      // toggle off
      bar.style.height = maxHeight + "px";
      void bar.offsetHeight;
      bar.style.height = "60px";
      await new Promise(end => {
        bar.addEventListener("transitionend", () => {
          end(true);
        }, { once: true });
      });
    }
  },

  // toggle color of advanced options icon
  toggleAdvancedIcon () {
    const dataA = viewSearch.getAdvancedData();
    const checked = Object.values(dataA).filter(i => i).length;
    const icon = document.querySelector("#search-advanced-toggle img");
    if (!dataA["search-scope-0"] || checked > 1) {
      icon.src = "img/win/preferences-red.svg";
    } else {
      icon.src = "img/win/preferences.svg";
    }
  },

  // toggle checkboxes
  //   cb = node (changed checkbox)
  toggleScope (cb) {
    const scope0 = document.querySelector("#search-scope-0");
    if (cb.checked && cb.value !== "0") {
      scope0.checked = false;
    } else if (cb.checked && cb.value === "0") {
      const boxes = document.querySelectorAll("#search-scope input");
      for (let i = 1, len = boxes.length; i < len; i++) {
        boxes[i].checked = false;
      }
    }
    if (!document.querySelector("#search-scope input:checked")) {
      scope0.checked = true;
    }
    viewSearch.toggleAdvancedIcon();
  },
};

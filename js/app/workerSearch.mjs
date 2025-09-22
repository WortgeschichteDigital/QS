
import shared from "../shared.mjs";

const search = {
  // all data necessary to the analysis
  //   filters = object (filter bar filters)
  //   regExp = array (search expressions)
  //   results = array (added and filled by this worker; this will eventually be posted)
  //   scope = array (scope to which the search shall be limited)
  //   stripTags = boolean (don't search within tags)
  //   xmlData = object (same as xml.data.files)
  //   xmlFiles = object (same as xml.files)
  data: {},

  // perform search in XML files
  start () {
    const { data } = search;
    let nResults = 0;

    x: for (const [ file, values ] of Object.entries(data.xmlData)) {
      if (data.narrowSearch.size && !data.narrowSearch.has(file)) {
        continue;
      }

      // ignore files that don't match the filters
      if (data.filters["select-authors"] && !values.authors.includes(data.filters["select-authors"]) ||
          data.filters["select-domains"] && !values.domains.includes(data.filters["select-domains"]) ||
          data.filters["select-status"] && values.status !== data.filters["select-status"]) {
        continue;
      }

      // get lines within the scope
      let text = data.xmlFiles[file];
      if (!text) {
        continue;
      }
      const linesScope = [];
      for (const s of data.scope) {
        const lines = [];
        for (const m of text.matchAll(new RegExp("<" + s, "g"))) {
          lines.push({
            start: text.substring(0, m.index).split("\n").length,
            end: 0,
          });
        }
        let n = 0;
        for (const m of text.matchAll(new RegExp("</" + s, "g"))) {
          try {
            // the number of start and end tags can differ
            // when some are enclosed in comments
            lines[n].end = text.substring(0, m.index).split("\n").length;
          } catch {}
          n++;
        }
        for (let i = lines.length - 1; i >= 0; i--) {
          // remove all lines for which no end tag was found
          // (this may happen if the number of start and end tags differ
          // due to comments; see above)
          if (!lines[i].end) {
            lines.splice(i, 1);
          }
        }
        if (!lines.length) {
          // fill with placeholder if the element is missing in the current XML file
          linesScope.push(0);
        } else {
          for (const l of lines) {
            for (let i = l.start; i <= l.end; i++) {
              linesScope.push(i);
            }
          }
        }
      }

      // strip text of tags if needed
      if (data.stripTags) {
        text = text.replace(/<.+?>/g, "");
      }

      // search file
      const hits = Array(data.regExp.length).fill(false);
      const hitLines = {};
      let points = 0;
      for (let i = 0, len = data.regExp.length; i < len; i++) {
        for (const m of text.matchAll(data.regExp[i])) {
          const line = text.substring(0, m.index).split("\n").length;
          if (linesScope.length && !linesScope.includes(line)) {
            continue;
          }
          // all expressions must produce a hit
          hits[i] = true;
          // in case the user only wants to see hits in the same line
          if (!hitLines[line]) {
            hitLines[line] = Array(hits.length).fill(false);
          }
          hitLines[line][i] = true;
          // points for weighing the results
          points++;
        }
        data.regExp[i].lastIndex = -1;
      }
      if (hits.some(i => !i)) {
        continue;
      }

      // fill lines
      const lines = [];
      for (const [ k, v ] of Object.entries(hitLines)) {
        if (!data.sameLine ||
            data.sameLine && !v.some(i => !i)) {
          lines.push(parseInt(k, 10));
        }
      }
      if (!lines.length) {
        // this might happen if the user only wants to see hits in the same line
        continue;
      }

      // extract text
      lines.sort((a, b) => a - b);
      const textLines = text.split("\n");
      const textLinesLen = textLines.length;
      for (const l of lines) {
        const text = textLines[l - 1].trim();
        let textBefore = "";
        let textAfter = "";
        if (text.length < 200) {
          // text before
          let lineNo = l - 1;
          let line = "";
          while (!line && lineNo > 0) {
            lineNo--;
            line = textLines[lineNo].trim();
          }
          if (!lines.includes(lineNo + 1)) {
            const lineLen = line.length;
            let boundary = lineLen > 200 ? lineLen - 200 : 0;
            while (boundary > 0) {
              if (/^\b/.test(line.substring(boundary, boundary + 1))) {
                boundary += 2;
                break;
              }
              boundary--;
            }
            textBefore = line.substring(boundary, lineLen);
          }
          // text after
          lineNo = l - 1;
          line = "";
          while (!line && lineNo < textLinesLen - 1) {
            lineNo++;
            line = textLines[lineNo].trim();
          }
          if (!lines.includes(lineNo + 1)) {
            const lineLen = line.length;
            let boundary = lineLen > 200 ? 200 : lineLen;
            while (boundary < lineLen - 1) {
              if (/\b$/.test(line.substring(boundary - 1, boundary))) {
                boundary -= 2;
                break;
              }
              boundary++;
            }
            textAfter = line.substring(0, boundary);
          }
        }
        data.results.push({
          file,
          points,
          line: l,
          text,
          textBefore,
          textAfter,
        });

        // stop search if there are to many results
        nResults++;
        if (nResults > 5e3) {
          break x;
        }
      }
    }

    // sort results
    data.results.sort((a, b) => {
      if (a.points === b.points) {
        if (a.file === b.file) {
          return a.line - b.line;
        }
        return shared.sort(a.file, b.file);
      }
      return b.points - a.points;
    });
  },
};

self.addEventListener("message", evt => {
  search.data = evt.data;
  search.data.results = [];
  search.start();
  postMessage(search.data.results);
});

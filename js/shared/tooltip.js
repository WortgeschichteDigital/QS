"use strict";

let tooltip = {
	timeout: null,
	// skip timeout, show tooltip immediately
	noTimeout: false,
	// initialize tooltip
	//   basis = node | undefined
	init (basis = document) {
		basis.querySelectorAll("[title]").forEach(i => {
			i.dataset.tooltip = i.title;
			i.removeAttribute("title");
			i.addEventListener("mouseover", function() {
				clearTimeout(tooltip.timeout);
				const timeout = tooltip.noTimeout ? 0 : 500;
				tooltip.timeout = setTimeout(() => {
					tooltip.noTimeout = false;
					tooltip.on(this);
				}, timeout);
			});
			i.addEventListener("mouseout", () => tooltip.off());
		});
	},
	// show tooltip
	//   ele = node (on which the mouse hovers)
	on (ele) {
		let tip = document.querySelector("#tooltip");
		// create tooltip (if needed)
		if (!tip) {
			let div = document.createElement("div");
			div.id = "tooltip";
			tip = div;
			document.body.appendChild(div);
		}
		// Wide tooltip?
		if (ele.dataset.tooltip.length > 150) {
			tip.classList.add("wide");
		} else {
			tip.classList.remove("wide");
		}
		// fill tooltip
		tip.innerHTML = ele.dataset.tooltip;
		// position tooltip
		const width = tip.offsetWidth,
			height = tip.offsetHeight,
			rect = ele.getBoundingClientRect();
		let top = rect.bottom + 5;
		if (top + height > window.innerHeight - 20) {
			top = rect.top - 5 - height;
		}
		tip.style.top = top + "px";
		let left = rect.left + Math.round(rect.width / 2) - Math.round(tip.offsetWidth / 2);
		if (ele.nodeName === "P") {
			left = rect.left;
		} else if (left + width > window.innerWidth - 10) {
			left = rect.right - width;
		} else if (left < 10) {
			left = rect.left;
		}
		tip.style.left = left + "px";
		tip.style.zIndex = ++overlay.zIndex;
		tip.classList.add("visible");
	},
	// Tooltip ausblenden
	off () {
		clearTimeout(tooltip.timeout);
		let tip = document.querySelector("#tooltip");
		if (!tip) {
			return;
		}
		tip.addEventListener("transitionend", function() {
			if (!this.parentNode) {
				return;
			}
			this.parentNode.removeChild(this);
		}, { once: true });
		tip.classList.remove("visible");
	},
	// insert titel for search help
	searchHelp () {
		const title = `<p>Suchwörter sind durch <b>Leerzeichen</b> getrennt. Beim Suchen werden die einzelnen Wörter durch ein <b>logisches Und</b> miteinander verknüpft:<span class="example">alternative Fakten<br>= Suche nach „alternative“ UND „Fakten“.</span></p>
		<p>Taucht in einem Suchwort ein <b>Großbuchstabe</b> auf, wird bei der Suche für dieses Wort zwischen Groß- und Kleinschreibung unterschieden.</p>
		<p>Taucht im Suchausdruck eine <b>Spitzklammer</b> auf (&lt; oder &gt;), werden neben dem Text auch die Tags durchsucht.</p>
		<p>Als <b>Phrase</b> können mehrere Wörter mithilfe von nicht-typo\u00ADgraphi\u00ADschen Anführungs\u00ADzeichen gesucht werden:<span class="example">"alternative Fakten"<br>   oder<br>'alternative Fakten'<br>= Suche nach der Phrase „alternative Fakten“.</span></p>
		<p>Man kann auch mit <b>regulären Ausdrücken</b> suchen:<span class="example">/alternativen? fakt(en)?/i<br>= Phrasensuche, „alternativen“ mit oder ohne „n“, „fakt“ oder „fakten“, Groß- und Kleinschreibung irrelevant (wegen des optionalen i-Schalters hinter dem schließenden /).</span></p>`;
		document.querySelector("#search-help").title = title;
	},
};

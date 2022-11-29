"use strict";

let tooltip = {
	timeout: null,
	// skip timeout, show tooltip immediately
	noTimeout: false,
	// initialize tooltip
	//   basis = element | undefined
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
	//   ele = element (on which the mouse hovers)
	on (ele) {
		let tip = document.querySelector("#tooltip");
		// create tooltip (if needed)
		if (!tip) {
			let div = document.createElement("div");
			div.id = "tooltip";
			tip = div;
			document.body.appendChild(div);
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
		if (left + width > window.innerWidth - 10) {
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
};

import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
import QRCode from "qrcode"

import {
	fetchEventOrEvents,
	getAllPubkeysFromEvent,
	hydrateSpecialElements,
	login,
	markdownToHtml,
	ndkFilterFromAttributes,
	parseTemplateString,
	processContent,
	registerHnElement,
	wrapAll,
	setEventIdInUrl,
	updateQueriesWithEventId,
	refreshQueriesInOrder,
	getEventIdFromUrl,
} from "./utils";

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://nostr-pub.wellorder.net",
		"wss://nos.lol",
		"wss://offchain.pub",
		"wss://relay.damus.io",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

export class HyperNoteQueryElement extends HTMLElement {
	queryResult: NDKEvent[] = [];
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(this.nodeName, "\t\t\t", ...args);
	}

	static observedAttributes = [
		"kind",
		"authors",
		"limit",
		"d",
		"e",
		"event",
		"debug",
		"require"
	];

	constructor() {
		super();
	}

	async connectedCallback() {
		this.log("connectedCallback");
		try {
			await this.fetchQuery();
		} catch (e) {
			console.error("Error fetching query", e);
		}
	}

	async attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		if (oldValue === newValue) return;
		this.log("attributeChangedCallback", name, oldValue, newValue);

		// If the old value was a placeholder (#), or if we're setting a new event ID
		if (
			(typeof oldValue === "string" && oldValue.startsWith("#")) ||
			name === "e"
		) {
			console.log(`Triggering fetchQuery because ${name === "e" ? "e attribute changed" : "placeholder was replaced"}`);
			try {
				await this.fetchQuery();
			} catch (e) {
				console.error("Error fetching query", e);
			}
		} else {
			console.log(`Not triggering fetchQuery for ${name} change from ${oldValue} to ${newValue}`);
		}
	}

	async fetchQuery(isRefresh = false) {
		// TODO: need to not crash if a bad value is passed somewhere here
		const kind = this.getAttribute("kind");
		const authors = this.getAttribute("authors");
		const limit = this.getAttribute("limit");
		const event = this.getAttribute("event");
		const e = this.getAttribute("e");
		const d = this.getAttribute("d");
		const a = this.getAttribute("a");
		const require = this.getAttribute("require");

		// Skip placeholder resolution during refresh
		if (!isRefresh && e?.startsWith("#")) {
			console.log("Found reference to parent event ID:", e);
			// Find the parent hn-query
			const parentQuery = this.closest("hn-query") as HyperNoteQueryElement;
			console.log("Parent query:", parentQuery);
			if (parentQuery) {
				// If the reference is #e, we want the event ID that was queried
				if (e === "#e" && parentQuery.queryResult.length > 0) {
					const eventId = parentQuery.queryResult[0].id;
					console.log("Setting e to parent's queried event ID:", eventId);
					this.setAttribute("e", eventId);
					return; // The attributeChangedCallback will trigger another fetchQuery
				}
				// Otherwise try to get the e attribute
				const parentE = parentQuery.getAttribute("e");
				console.log("Parent event ID:", parentE);
				if (parentE) {
					console.log("Setting e to parent's e attribute:", parentE);
					this.setAttribute("e", parentE);
					return; // The attributeChangedCallback will trigger another fetchQuery
				}
			}
			console.warn("Could not resolve parent reference:", e);
			return;
		}

		// Skip placeholder resolution during refresh
		if (!isRefresh && authors?.startsWith("#")) {
			console.warn("Authors starts with #, it's a reference to a field");
			return;
		}

		this.log(
			`fetchQuery... kind: ${kind}, authors: ${authors}, limit: ${limit}, event: ${event}, e: ${e}, d: ${d}, a: ${a}, require: ${require}`
		);

		try {
			// TODO: validate that the event is a valid hexpub
			// If there's an event ID, fetch that specific event
			if (event) {
				console.log("Fetching specific event by ID:", event);
				const ev = await ndk.fetchEvent(
					{
						ids: [event],
					},
					{
						closeOnEose: true,
					}
				);
				if (ev) {
					console.log("Found event:", ev.rawEvent());
					this.queryResult = [ev as NDKEvent];
					try {
						console.log("About to render with queryResult:", this.queryResult);
						await this.render();
					} catch (e) {
						console.error("Failed to render", this, e);
					}
				} else {
					console.log("No event found for ID:", event);
				}
				return;
			}

			// If there's an e tag, fetch events that reference this event
			if (e) {
				console.log("Fetching events that reference event ID:", e);
				const filter = ndkFilterFromAttributes(this);
				console.log("Using filter:", filter);
				const qr = await fetchEventOrEvents(filter, ndk);
				console.log("Query results:", qr);
				// Make sure the returned event includes a tag[] in tags[] that starts with ${require}
				if (require) {
					this.queryResult = qr.filter((e) => {
						const tags = e.tags;
						console.log("tags", tags);
						const found = tags.find((t) => t[0] === require);
						console.log("found", found);
						return found;
					});
				} else {
					this.queryResult = qr;
				}
			} else {
				// Regular filter-based query
				const filter = ndkFilterFromAttributes(this);
				console.log("No event/e specified, using filter:", filter);
				console.log("filter", filter);

				const qr = await fetchEventOrEvents(filter, ndk);
				console.log("Query results:", qr);
				// Make sure the returned event includes a tag[] in tags[] that starts with ${require}
				if (require) {
					this.queryResult = qr.filter((e) => {
						const tags = e.tags;
						console.log("tags", tags);
						const found = tags.find((t) => t[0] === require);
						console.log("found", found);
						return found;
					});
				} else {
					this.queryResult = qr;
				}
			}
		} catch (e) {
			console.error("fetching event error", e);
		}

		try {
			console.log("About to render with queryResult:", this.queryResult);
			await this.render();
		} catch (e) {
			console.error("Failed to render", this, e);
		}
	}

	async render() {
		this.log("render");
		console.log("this.queryResult", this.queryResult);

		const firstChild = this.firstElementChild;
		console.log("firstChild:", firstChild);

		if (!firstChild) {
			console.error(
				"hn-query requires one hn-element or one hn-element child. rendering events in pre tags as a fallback"
			);
			// Instead of erroring, let's render the events in pre tags as a fallback
			this.queryResult.forEach((event) => {
				const pre = document.createElement("pre");
				pre.style.whiteSpace = "pre-wrap";
				pre.style.wordBreak = "break-word";
				pre.innerText = JSON.stringify(event?.rawEvent(), null, 2);
				this.appendChild(pre);
			});
			return;
		}

		const firstChildTagName = firstChild.tagName.toLowerCase();
		console.log("firstChildTagName:", firstChildTagName);

		if (firstChildTagName === "hn-query") {
			const authors = firstChild.getAttribute("authors");

			if (authors?.startsWith("#")) {
				// Put the array of pubkeys from the tags in here
				if (this.queryResult.length === 0) {
					console.error(
						"Can't get authors from tags if there are no events"
					);
					return;
				}

				const pubkeys = getAllPubkeysFromEvent(this.queryResult[0]);

				// If we don't find a bunch of pubkeys we'll just do the one pubkey
				if (pubkeys.length === 0) {
					console.log("single pubkey");
					const pubkey = this.queryResult[0].pubkey;
					firstChild.setAttribute("authors", pubkey);
				} else {
					console.log("pubkeys", pubkeys);
					firstChild.setAttribute("authors", JSON.stringify(pubkeys));
				}
			}
			return;
		}

		let template: HTMLTemplateElement | null;

		try {
			console.log("Attempting to register hn-element:", firstChild);
			template = await registerHnElement(firstChild, ndk);
			console.log("Registered template:", template);

			if (this.queryResult.length === 0) {
				const templateId = firstChild.getAttribute("id");
				console.log("No query results, cloning empty template with ID:", templateId);
				const clone = template?.content.cloneNode(true);
				console.log("Cloned node:", clone);
				const newElement = document.createElement("hn-element");
				newElement.attachShadow({ mode: "open" });
				newElement.shadowRoot?.appendChild(clone!);
				newElement.setAttribute("id", firstChild.getAttribute("id")!);
				this.appendChild(newElement);
				firstChild.remove();
				return;
			}
		} catch (e) {
			console.error("error registering hn-element", e);
			return;
		}

		const templateId = firstChild.getAttribute("id");
		console.log("Template ID for results:", templateId);

		if (!templateId) {
			console.error("hn-element requires an id");
			return;
		}

		console.log("About to render", this.queryResult.length, "results");
		this.queryResult.forEach((event, i) => {
			console.log(`Rendering result ${i}:`, event.rawEvent());
			const clone = template?.content.cloneNode(true);
			console.log(`Cloned template for result ${i}:`, clone);
			const newElement = document.createElement("hn-element");
			newElement.attachShadow({ mode: "open" });
			newElement.shadowRoot?.appendChild(clone!);
			newElement.setAttribute("id", templateId);
			newElement.setAttribute(
				"hn-event-data",
				JSON.stringify(event?.rawEvent())
			);
			this.appendChild(newElement);
			console.log(`Added new element for result ${i}`);
		});
		firstChild.remove();

		if (this.hasAttribute("debug")) {
			const wrapperDiv = document.createElement("div");
			wrapperDiv.style.border = "1px solid red";

			const infoBanner = document.createElement("div");
			infoBanner.innerText = `hn-query: kind: ${this.getAttribute(
				"kind"
			)}, authors: ${this.getAttribute(
				"authors"
			)}, limit: ${this.getAttribute("limit")}, d: ${this.getAttribute(
				"d"
			)}, a: ${this.getAttribute("a")}, e: ${this.getAttribute(
				"e"
			)}, debug: ${this.getAttribute("debug")}`;
			infoBanner.style.backgroundColor = "gray";
			infoBanner.style.fontFamily = "monospace";

			this.insertBefore(infoBanner, this.firstChild);

			wrapAll(this.childNodes, wrapperDiv);
		}

		this.childNodes;
	}
}

class HyperNoteElement extends HTMLElement {
	queryResult: NDKEvent[] = [];
	templateName: string | undefined;
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(this.nodeName, "\t\t\t", ...args);
	}

	static observedAttributes = ["hn-event-data", "debug"];

	constructor() {
		super();
	}

	async connectedCallback() {
		this.log("connectedCallback");
		// TODO: is this cool to do?
		this.setAttribute("style", "display: hidden");

		setTimeout(() => {}, 0);

		const templateId = this.getAttribute("hn-template");

		const [npub, templateName] = parseTemplateString(templateId);

		if (!npub || !templateName) {
			console.error(
				"Invalid template string. Should be formatted as nostr:<npub>/<templateName>"
			);
		}
	}

	async attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		if (oldValue === newValue) return;
		this.log("attributeChangedCallback", name, oldValue, newValue);

		if (name === "hn-event-data" || name === "id") {
			this.render();
		}
	}

	render() {
		this.log("render");
		this.setAttribute("style", "display: revert");

		const event = JSON.parse(this.getAttribute("hn-event-data") || "{}");
		console.log("Event data for hydration:", event);

		if (!event) {
			console.error("Tried to render without event data");
			return;
		}

		let content = processContent(event.content);
		console.log("Processed content:", content);

		let shadowRoot = this.shadowRoot;

		if (!shadowRoot) {
			const templateElement = document.querySelector(
				"#" + this.getAttribute("id")
			) as HTMLTemplateElement;
			console.log("Found template element:", templateElement);

			// Clone the template and add it to the dom
			const newShadow = this.attachShadow({ mode: "open" });
			newShadow.appendChild(templateElement.content.cloneNode(true));
			shadowRoot = newShadow;
		}

		// Find all the named slots
		const slots = shadowRoot.querySelectorAll("slot");
		console.log("Found slots:", slots);

		console.log("hydrating slots", event);
		slots.forEach((s) => {
			const field = s.getAttribute("name")!;
			console.log("Processing slot with name:", field);
			const fieldParts = field.split(".");

			if (!field) {
				console.error("No field name found on slot");
				return;
			}

			// If the field starts with "tag.", we're looking for a specific tag value
			if (field.startsWith("tag.")) {
				const [_, tagName, ...indices] = fieldParts;
				console.log(`Looking for tag ${tagName} with indices:`, indices);

				const tags = event.tags;
				console.log("Looking through tags:", tags);
				// Find the tag with the matching name
				const tag = tags.find((t: string[]) => t[0] === tagName);
				console.log("Found tag:", tag);
				if (tag) {
					// If we have indices, get the specific value
					if (indices.length > 0) {
						const index = parseInt(indices[0]);
						console.log(`Getting value at index ${index}:`, tag[index]);
						s.innerText = tag[index];
					} else {
						// Otherwise get the first value
						console.log("Getting first value:", tag[1]);
						s.innerText = tag[1];
					}
				}
				return;
			}

			// Handle regular event fields and content fields
			if (!event[field] && !content?.[fieldParts[1]]) {
				console.log(
					`No field found for ${field}, looking in tags`
				);

				const tags = event.tags;
				console.log("Looking through tags:", tags);
				// Tags are formatted as an array of ["key", "value"] arrays
				// We need to find the tag with the key we're looking for
				const tag = tags.find((t: string[]) => t[0] === field);
				console.log("Found tag:", tag);
				if (tag) {
					console.log("Setting slot text to tag value:", tag[1]);
					s.innerText = tag[1];
				}
			} else {
				if (fieldParts.length === 1) {
					console.log(`Setting slot text to event field ${field}:`, event[field]);
					s.innerText = event[field];
				}

				if (fieldParts.length === 2) {
					console.log(`Setting slot text to content field ${fieldParts[1]}:`, content[fieldParts[1]]);
					s.innerText = content[fieldParts[1]];
				}
			}

			// Let's see what s looks like now
			console.log("Hydrated slot element:", s);
		});

		// Find all the author attributes that are just a #
		// const authorAttributes =
		// 	shadowRoot.querySelectorAll("hn-query[authors]");

		// NICE this worked
		// Find all the author attributes that are just a # and aren't a child of another hn-query
		const authorAttributes = shadowRoot.querySelectorAll(
			"hn-query[authors]:not(hn-query hn-query)"
		);
		authorAttributes.forEach((a) => {
			const authors = a.getAttribute("authors");
			if (authors?.startsWith("#")) {
				a.setAttribute("authors", event.pubkey);
			}
		});

		// this.hydrateLinks();

		const debug = this.hasAttribute("debug");

		if (debug) {
			const preDiv = document.createElement("pre");
			preDiv.innerText = JSON.stringify(event, null, 2);
			shadowRoot.appendChild(preDiv);
		}

		// Find all the special elements and set their event data
		const specialElements = shadowRoot.querySelectorAll(
			"hn-a, hn-time, hn-img, hn-markdown, hn-iframe, hn-qr"
		);
		specialElements.forEach((element) => {
			element.setAttribute("hn-event-data", JSON.stringify(event));
		});

		hydrateSpecialElements(shadowRoot, "hn-a", event, content);
		hydrateSpecialElements(shadowRoot, "hn-time", event, content);
		hydrateSpecialElements(shadowRoot, "hn-img", event, content);
		hydrateSpecialElements(shadowRoot, "hn-markdown", event, content);
		hydrateSpecialElements(shadowRoot, "hn-iframe", event, content);
		hydrateSpecialElements(shadowRoot, "hn-qr", event, content);
	}
}

class SpecialElement extends HTMLElement {
	name: string = "base-special-element";
	// LOGGING
	// @ts-expect-error

	log(...args) {
		console.log(
			this.nodeName,
			`${this.name}:${this.getAttribute(this.name)}`,
			"\t\t\t",
			...args
		);
	}

	static get observedAttributes() {
		return ["value"];
	}

	constructor() {
		super();
	}

	attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		this.log(
			`attributeChangedCallback name:${name}, old:${oldValue}, new:${newValue}`
		);
		this.render();
	}

	connectedCallback() {
		console.log(`${this.name} connectedCallback`);
		this.render();
	}

	render() {
		const value = this.getAttribute("value");
		this.innerHTML = /* html */ `
            <pre>${this.name}: ${value}</pre>
            `;
	}
}

class HyperNoteAElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-a";
	}

	render() {
		const value = this.getAttribute("value");

		// See if we have an inner a tag already
		const innerA = this.querySelector("a");
		if (innerA) {
			// If we do, we'll just replace the href
			innerA.href = `https://njump.me/${value}`;
			return;
		} else {
			// If we don't, we'll create a new a tag
			const newEle = document.createElement("a");
			newEle.href = `https://njump.me/${value}`;
			newEle.innerHTML = this.innerHTML;
			this.replaceChildren(newEle);
		}
	}
}

class HyperNoteTimeElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-time";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-time");
			return;
		}

		if (isNaN(Number(value))) {
			console.error(
				"Invalid value provided for hn-time. Should be a unix timestamp"
			);
			return;
		}

		const date = new Date(Number(value) * 1000);

		this.innerHTML = /* html */ `
            <time datetime="${date.toISOString()}">${date.toLocaleString()}</time>
            `;
	}
}

class HyperNoteImgElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-img";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-img");
			return;
		}

		console.log("about to render image");

		this.innerHTML = /* html */ `
            <img src="${value}" />
            `;
	}
}

class HyperNoteMarkdownElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-markdown";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-markdown");
			return;
		}

		this.innerHTML = /* html */ `
            <div>${markdownToHtml(value)}</div>
            `;
	}
}

class HyperNoteFormElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-form";
	}

	render() {
		// Create a new form element with the same inner html
		const newForm = document.createElement("form");
		newForm.innerHTML = this.innerHTML;

		newForm?.addEventListener("submit", async (e) => {
			e.preventDefault();
			console.log("Form submitted");

			// get the submit data
			const formData = new FormData(newForm as HTMLFormElement);
			console.log("Form data:", Object.fromEntries(formData));

			if (formData.get("content") === "" && !formData.get("i")) {
				alert("Please enter some content");
				return;
			}

			const kind = parseInt(formData.get("kind") as string || "1");
			const nostrEvent = new NDKEvent(ndk);
			nostrEvent.kind = kind;
			nostrEvent.content = formData.get("content") as string || "";

			// Handle standard p tag
			const p = formData.get("p") as string;
			if (p) {
				nostrEvent.tags.push(["p", p]);
			}

			// Handle standard a tag
			const a = formData.get("a") as string;
			if (a) {
				try {
					const aParsed = JSON.parse(a);
					if (aParsed && aParsed.length > 0 && Array.isArray(aParsed)) {
						nostrEvent.tags.push(["a", ...aParsed]);
					}
				} catch (e) {
					console.error("Failed to parse a tag", e);
				}
			}

			// Handle i tag for DVM requests
			const i = formData.get("i") as string;
			if (i) {
				try {
					const iParsed = JSON.parse(i);
					nostrEvent.tags.push(["i", JSON.stringify(iParsed)]);
				} catch (e) {
					console.error("Failed to parse i tag", e);
				}
			}

			console.log("About to publish event:", nostrEvent.rawEvent());

			await login(ndk);

			try {
				await nostrEvent.publish();
				console.log("Event published successfully with ID:", nostrEvent.id);
			} catch (err) {
				console.error("Failed to publish event:", err);
				return;
			}

			// Check for target element to update
			const targetId = this.getAttribute("target");
			if (!targetId) {
				console.log("No target ID specified, reloading page");
				window.location.reload();
				return;
			}

			// Strip the # from the target ID
			const selector = targetId.startsWith("#") ? targetId.substring(1) : targetId;
			
			// Find the shadow root we're in
			const shadowRoot = this.getRootNode() as ShadowRoot;
			console.log("Found shadow root:", shadowRoot);

			// Find all target hn-query elements within the shadow root
			const queries = shadowRoot.querySelectorAll(`hn-query#${selector}`);
			console.log("Found target hn-queries:", queries);

			if (queries.length > 0) {
				// Update URL with the new event ID
				setEventIdInUrl(nostrEvent.id, selector);
				// Update queries with the event ID
				updateQueriesWithEventId(queries, nostrEvent.id);
				// Refresh all queries in order
				await refreshQueriesInOrder(queries);
			} else {
				console.error("No target hn-queries found");
			}
		});

		this.replaceChildren(newForm);
	}
}

class HyperNoteIframeElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-iframe";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-iframe");
			return;
		}

		const base64 = btoa(value);

		const dataUrl = `data:text/html;base64,${base64}`;

		this.innerHTML = /* html */ `<iframe src="${dataUrl}"></iframe>`;
	}
}

class HyperNoteQrCodeElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-qr";
	}

	async render() {
		const valueRef = this.getAttribute("value");
		if (!valueRef) {
			console.error("No value provided for hn-qr");
			return;
		}

		// If the value refers to a tag, get the tag value
		if (valueRef.startsWith("tag.")) {
			const [_, tagName, index] = valueRef.split(".");
			const event = JSON.parse(this.getAttribute("hn-event-data") || "{}");
			const tag = event.tags?.find((t: string[]) => t[0] === tagName);
			if (tag && tag[index]) {
				try {
					const qr = await QRCode.toDataURL(tag[index]);
					this.innerHTML = /* html */ `<img src="${qr}" />`;
				} catch (e) {
					console.error("Failed to generate QR code:", e);
				}
			} else {
				console.error(`No tag value found for ${valueRef}`);
			}
			return;
		}

		// Otherwise use the value directly
		try {
			const qr = await QRCode.toDataURL(valueRef);
			this.innerHTML = /* html */ `<img src="${qr}" />`;
		} catch (e) {
			console.error("Failed to generate QR code:", e);
		}
	}
}

class HyperNoteRefreshElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-refresh";
	}

	render() {
		// Create a button if it doesn't exist
		if (!this.querySelector('button')) {
			const button = document.createElement('button');
			button.innerText = this.innerHTML || 'Refresh';
			
			button.addEventListener('click', async () => {
				console.log("Refresh button clicked");
				const shadowRoot = this.getRootNode() as ShadowRoot;
				
				// Find the closest hn-form to get its target ID
				const form = shadowRoot.querySelector('hn-form');
				if (!form) {
					console.error("No hn-form found in shadow root");
					return;
				}

				const targetId = form.getAttribute('target');
				if (!targetId) {
					console.error("No target ID found in form");
					return;
				}

				// Strip the # from the target ID
				const selector = targetId.startsWith("#") ? targetId.substring(1) : targetId;
				
				// Get event ID from URL
				const eventId = getEventIdFromUrl(selector);
				if (!eventId) {
					console.error("No event ID found in URL for", selector);
					return;
				}

				console.log("Found event ID in URL:", eventId);
				
				// Find all queries with this ID
				const queries = shadowRoot.querySelectorAll(`hn-query#${selector}`);
				console.log(`Found queries with ID ${selector} to refresh:`, queries);

				if (queries.length === 0) {
					console.error("No queries found to refresh");
					return;
				}

				// Update queries with the event ID and refresh them
				updateQueriesWithEventId(queries, eventId);
				await refreshQueriesInOrder(queries);
			});

			this.replaceChildren(button);
		}
	}
}

customElements.define("hn-a", HyperNoteAElement);
customElements.define("hn-time", HyperNoteTimeElement);
customElements.define("hn-img", HyperNoteImgElement);
customElements.define("hn-markdown", HyperNoteMarkdownElement);
customElements.define("hn-form", HyperNoteFormElement);
customElements.define("hn-iframe", HyperNoteIframeElement);
customElements.define("hn-qr", HyperNoteQrCodeElement);
customElements.define("hn-refresh", HyperNoteRefreshElement);

customElements.define("hn-element", HyperNoteElement);
customElements.define("hn-query", HyperNoteQueryElement);

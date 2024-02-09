import NDK, { NDKEvent, NostrEvent } from "@nostr-dev-kit/ndk";

import {
	fetchEventOrEvents,
	getAllPubkeysFromEvent,
	hydrateSpecialElements,
	login,
	markdownToHtml,
	ndkFilterFromAttributes,
	parseTemplateString,
	processContent,
	pubkeyToHexpub,
	registerHnElement,
	wrapAll,
} from "./utils";

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://pablof7z.nostr1.com",
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

	static observedAttributes = ["kind", "authors", "limit", "d", "e", "debug"];

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

		if (
			typeof newValue === "string" &&
			typeof oldValue === "string" &&
			oldValue.startsWith("#")
		) {
			try {
				await this.fetchQuery();
			} catch (e) {
				console.error("Error fetching query", e);
			}
		}
	}

	async fetchQuery() {
		// TODO: need to not crash if a bad value is passed somewhere here
		const kind = this.getAttribute("kind");
		const authors = this.getAttribute("authors");
		const limit = this.getAttribute("limit");
		const event = this.getAttribute("event");
		const d = this.getAttribute("d");
		const a = this.getAttribute("a");
		const e = this.getAttribute("e");

		if (authors?.startsWith("#")) {
			console.warn("Authors starts with #, it's a reference to a field");
			return;
		}

		this.log(
			`fetchQuery... kind: ${kind}, authors: ${authors}, limit: ${limit}, event: ${event}, d: ${d}, a: ${a}, e: ${e}`
		);

		try {
			// TODO: validate that the event is a valid hexpub
			if (event) {
				const e = await ndk.fetchEvent(
					{
						ids: [event],
					},
					{
						closeOnEose: true,
					}
				);
				if (e) {
					this.queryResult = [e as NDKEvent];
				}
				return;
			} else {
				const filter = ndkFilterFromAttributes(this);
				console.log("filter", filter);

				this.queryResult = await fetchEventOrEvents(filter, ndk);
			}
		} catch (e) {
			console.error("fetching event error", e);
		}

		try {
			await this.render();
		} catch (e) {
			console.error("Failed to render", this, e);
		}
	}

	async render() {
		this.log("render");

		console.log("this.queryResult", this.queryResult);

		const firstChild = this.firstElementChild;

		if (!firstChild) {
			console.error(
				"hn-query requires one hn-element or one hn-element child"
			);
			return;
		}

		const firstChildTagName = firstChild.tagName.toLowerCase();

		// TODO: more robust
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

				// firstChild.setAttribute(
				// 	"authors",
				// 	JSON.stringify([
				// 		"de845999855e6457762af0101b2e957edef941d9f2190c1fec1108420f5f3ce4",
				// 	])
				// );
				// firstChild.render();
			}
			return;
		}

		if (firstChildTagName !== "hn-element") {
			console.error(
				"hn-query requires one hn-element or one hn-element child"
			);
			return;
		}

		let template: HTMLTemplateElement | null;

		try {
			template = await registerHnElement(firstChild, ndk);
		} catch (e) {
			console.error("error registering hn-element", e);
		}

		const templateId = firstChild.getAttribute("id");

		if (!templateId) {
			console.error("hn-element requires an id");
			return;
		}

		this.queryResult.forEach((event, _i) => {
			console.log("cloning node");
			const clone = template?.content.cloneNode(true);
			console.log(`attempting to clone ${templateId}`, clone);
			const newElement = document.createElement("hn-element");
			newElement.attachShadow({ mode: "open" });
			newElement.shadowRoot?.appendChild(clone!);
			newElement.setAttribute("id", firstChild.getAttribute("id")!);
			newElement.setAttribute(
				"hn-event-data",
				JSON.stringify(event?.rawEvent())
			);
			this.appendChild(newElement);
			firstChild.remove();
		});

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

	static observedAttributes = ["hn-event-data"];

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

		// if (npub && templateName) {
		// 	await this.swapForNewTemplate();
		// }
	}

	// async swapForNewTemplate() {
	// 	const templateId = this.getAttribute("hn-template");

	// 	const [npub, templateName] = parseTemplateString(templateId);

	// 	if (!npub || !templateName) {
	// 		console.error(
	// 			"Invalid template string. Should be formatted as nostr:<npub>/<templateName>"
	// 		);
	// 	}

	// 	// If the template already exists no need to add it again
	// 	// TODO: this check doesn't work, we fetch each time
	// 	if (document.querySelector("#" + templateName)) {
	// 		console.log(`Template ${templateName} already exists`);
	// 		return;
	// 	} else {
	// 		console.log(`Fetching template ${templateName}`);
	// 		const template = await this.fetchTemplate(npub, templateName);

	// 		if (!template) {
	// 			console.error("No template found");
	// 			return;
	// 		}

	// 		// Add the template to the dom
	// 		const templateElement = templateFromHtml(template);
	// 		templateElement?.setAttribute("id", templateName);
	// 		if (!templateElement) {
	// 			console.error("Invalid template");
	// 			return;
	// 		}
	// 		document.body.append(templateElement);
	// 	}

	// 	this.templateName = templateName;

	// 	const templateElement = document.querySelector(
	// 		"#" + this.templateName
	// 	) as HTMLTemplateElement;

	// 	// Clone the template and
	// 	const shadow = this.shadowRoot;
	// 	shadow?.replaceChildren(templateElement.content.cloneNode(true));

	// 	// this.hydrateLinks();

	// 	this.render();
	// }

	async fetchTemplate(npub: string, templateName: string) {
		console.log("fetching template", npub, templateName);
		const hexpub = pubkeyToHexpub(npub);
		const events = await ndk.fetchEvents({
			kinds: [32616 as number],
			authors: [hexpub],
			"#d": [templateName],
		});

		if (events.size === 0) {
			console.error("No events found for this template");
			return;
		}

		const event = events.values().next().value as NostrEvent;

		return event.content;
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

		if (!event) {
			console.error("Tried to render without event data");
			return;
		}

		let content = processContent(event.content);

		let shadowRoot = this.shadowRoot;

		if (!shadowRoot) {
			const templateElement = document.querySelector(
				"#" + this.templateName
			) as HTMLTemplateElement;

			// Clone the template and add it to the dom
			const newShadow = this.attachShadow({ mode: "open" });
			newShadow.appendChild(templateElement.content.cloneNode(true));
			shadowRoot = newShadow;
		}

		// Find all the named slots
		const slots = shadowRoot.querySelectorAll("slot");
		console.log("slots", slots);

		console.log("hydrating slots", event);
		slots.forEach((s) => {
			const field = s.getAttribute("name")!;
			const fieldParts = field.split(".");

			if (!field || !event || !content) {
				console.error("No field, event, or content found");
				// return;
			} else {
				// If the field isn't in the event or the content we need to look in the tags
				if (!event[field] && !content[fieldParts[1]]) {
					console.error(
						`No field found for ${field}, looking in tags`
					);

					const tags = event.tags;
					console.log("tags", tags);
					// Tags are formatted as an array of ["key", "value"] arrays
					// We need to find the tag with the key we're looking for
					const tag = tags.find((t: string[]) => t[0] === field);
					if (tag) {
						s.innerText = tag[1];
					}
				} else {
					if (fieldParts.length === 1) {
						s.innerText = event[field];
					}

					if (fieldParts.length === 2) {
						s.innerText = content[fieldParts[1]];
					}
				}

				// Let's see what s looks like now
				console.log("hydrated slot element", s);
			}
		});

		// Find all the author attributes that are just a #
		const authorAttributes =
			shadowRoot.querySelectorAll("hn-query[authors]");
		authorAttributes.forEach((a) => {
			const authors = a.getAttribute("authors");
			if (authors?.startsWith("#")) {
				a.setAttribute("authors", event.pubkey);
			}
		});

		// this.hydrateLinks();

		hydrateSpecialElements(shadowRoot, "hn-a", event, content);
		hydrateSpecialElements(shadowRoot, "hn-time", event, content);
		hydrateSpecialElements(shadowRoot, "hn-img", event, content);
		hydrateSpecialElements(shadowRoot, "hn-markdown", event, content);
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

			// get the submit data
			const formData = new FormData(newForm as HTMLFormElement);
			console.log(Object.fromEntries(formData));

			if (formData.get("content") === "") {
				alert("Please enter some content");
				return;
			}

			// TODO: don't hardcode the kind
			const nostrEvent = new NDKEvent(ndk);
			nostrEvent.kind = 1;
			nostrEvent.content = formData.get("content") as string;

			const p = formData.get("p") as string;
			if (p) {
				nostrEvent.tags.push(["p", p]);
			}

			const a = formData.get("a") as string;
			const aParsed = JSON.parse(a);
			console.log("aParsed", aParsed);
			if (aParsed && aParsed.length > 0 && Array.isArray(aParsed)) {
				nostrEvent.tags.push(["a", ...aParsed]);
			}

			console.log("nostrEvent", nostrEvent.rawEvent());

			await login(ndk);

			await nostrEvent.publish();

			window.location.reload();
		});

		console.log("rendering form", newForm);

		this.replaceChildren(newForm);
	}
}

customElements.define("hn-a", HyperNoteAElement);
customElements.define("hn-time", HyperNoteTimeElement);
customElements.define("hn-img", HyperNoteImgElement);
customElements.define("hn-markdown", HyperNoteMarkdownElement);
customElements.define("hn-form", HyperNoteFormElement);

customElements.define("hn-element", HyperNoteElement);
customElements.define("hn-query", HyperNoteQueryElement);

import NDK, { NDKEvent, NostrEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

// markdown stuff
import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import sanitizeHtml from "sanitize-html";

const prefixes = [
	"nprofile",
	"nrelay",
	"nevent",
	"naddr",
	"nsec",
	"npub",
	"note",
];

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://pablof7z.nostr1.com",
		"wss://nostr-pub.wellorder.net",
		"wss://nos.lol",
		"wss://offchain.pub",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

class HyperNoteElement extends HTMLElement {
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(
			this.nodeName,
			`hn-template:${this.getAttribute("hn-template")}`,
			"\t\t\t",
			...args
		);
	}

	templateName: string | undefined;

	static observedAttributes = ["hn-template", "hn-event", "hn-event-data"];

	constructor() {
		super();
	}

	async connectedCallback() {
		// LOGGING
		this.log(
			"connectedCallback",
			this.innerHTML || "innerHTML not parsed yet"
		);

		// be aware this.innerHTML is only available for PARSED elements
		// use setTimeout(()=>{...},0) if you do need this.innerHTML

		const templateId = this.getAttribute("hn-template");

		const [npub, templateName] = parseTemplateString(templateId);

		if (!npub || !templateName) {
			console.error(
				"Invalid template string. Should be formatted as nostr:<npub>/<templateName>"
			);
		}

		this.templateName = templateName;

		// If the template already exists no need to add it again
		// TODO: this check doesn't work, we fetch each time
		if (document.querySelector("#" + templateName)) {
			console.log(`Template ${templateName} already exists`);
			return;
		} else {
			console.log(`Fetching template ${templateName}`);
			const template = await this.fetchTemplate(npub, templateName);

			if (!template) {
				console.error("No template found");
				return;
			}

			// Add the template to the dom
			const templateElement = fromHTML(template);
			if (!templateElement) {
				console.error("Invalid template");
				return;
			}
			document.body.append(templateElement);
		}
	}

	async swapForNewTemplate() {
		const templateId = this.getAttribute("hn-template");

		const [npub, templateName] = parseTemplateString(templateId);

		if (!npub || !templateName) {
			console.error(
				"Invalid template string. Should be formatted as nostr:<npub>/<templateName>"
			);
		}

		// If the template already exists no need to add it again
		// TODO: this check doesn't work, we fetch each time
		if (document.querySelector("#" + templateName)) {
			console.log(`Template ${templateName} already exists`);
			return;
		} else {
			console.log(`Fetching template ${templateName}`);
			const template = await this.fetchTemplate(npub, templateName);

			if (!template) {
				console.error("No template found");
				return;
			}

			// Add the template to the dom
			const templateElement = fromHTML(template);
			if (!templateElement) {
				console.error("Invalid template");
				return;
			}
			document.body.append(templateElement);
		}

		this.templateName = templateName;

		const templateElement = document.querySelector(
			"#" + this.templateName
		) as HTMLTemplateElement;

		// Clone the template and
		const shadow = this.shadowRoot;
		shadow?.replaceChildren(templateElement.content.cloneNode(true));

		this.hydrateLinks();

		this.render();
	}

	async attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		this.log(
			`attributeChangedCallback name:${name}, old:${oldValue}, new:${newValue}`
		);
		if (newValue && name === "hn-template" && newValue !== oldValue) {
			await this.swapForNewTemplate();
			this.render();
		}
		if (newValue && name === "hn-event-data" && newValue !== oldValue) {
			this.render();
		}
	}

	render() {
		if (!this.templateName) {
			console.error("Tried to render without a template name");
			return;
		}

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
						s.innerHTML = tag[1];
					}
				} else {
					if (fieldParts.length === 1) {
						s.innerHTML = event[field];
					}

					if (fieldParts.length === 2) {
						s.innerHTML = content[fieldParts[1]];
					}
				}
			}
		});

		// TODO: clean this up!
		this.hydrateLinks();

		hydrateSpecialElements(shadowRoot, "hn-a", event, content);
		hydrateSpecialElements(shadowRoot, "hn-time", event, content);
		hydrateSpecialElements(shadowRoot, "hn-img", event, content);
		hydrateSpecialElements(shadowRoot, "hn-markdown", event, content);
	}

	hydrateLinks() {
		console.log("hydrating links");
		let shadowRoot = this.shadowRoot;
		// find all the a tags
		const links = shadowRoot?.querySelectorAll("a");
		if (links) {
			links.forEach((l) => {
				const originalHref = l.getAttribute("href");
				if (!originalHref) {
					console.error("No href found for link");
				} else {
					// l.style.backgroundColor = "pink";
					// l.href = `#`;
					l.onclick = async (e) => {
						e.preventDefault();
						console.log("clicked", originalHref);
						// this.setAttribute("hn-template", originalHref);

						// fetch the event. if it's a kind 32616, we'll use it as the new template
						// if it's not, we'll use it as the new event data for the current template

						// the url looks like this: nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/single-slide

						// we need to parse the url and fetch the event
						const [npub, templateName] =
							parseTemplateString(originalHref);
						const hexpub = pubkeyToHexpub(npub);

						const eventData = await ndk.fetchEvent({
							authors: [hexpub],
							"#d": [templateName],
						});

						if (!eventData) {
							console.error("No event data found for this link");
							return;
						}

						if (eventData.kind === 32616) {
							console.log(
								"eventData while parsing links",
								eventData
							);

							document
								.createElement("hn-element")
								.setAttribute("hn-template", originalHref);
							const ele = document.createElement("hn-element");
							ele.setAttribute("hn-template", originalHref);
							this.shadowRoot?.replaceChildren(ele);
						} else {
							// find our parent and replace the "d" attribute with the new template name
							const parent = this.parentElement;
							if (parent) {
								console.log("parent", parent);
								parent.setAttribute("d", templateName);
							}
						}
					};
				}
			});
		}
	}

	async fetchEvent(id: string) {
		const eventData = await ndk.fetchEvent({
			ids: [id],
		});

		console.log(eventData?.rawEvent());

		if (eventData?.rawEvent()) {
			this.setAttribute(
				"hn-event-data",
				JSON.stringify(eventData.rawEvent())
			);
			// this.eventData = JSON.stringify(eventData.rawEvent());
		}

		this.render();
	}

	async fetchTemplate(npub: string, templateName: string) {
		const hexpub = pubkeyToHexpub(npub);
		const events = await ndk.fetchEvents({
			kinds: [32616],
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
}

class HyperNoteQueryElement extends HTMLElement {
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(
			this.nodeName,
			`hn-query:${this.getAttribute("hn-query")}`,
			"\t\t\t",
			...args
		);
	}

	static observedAttributes = ["kind", "authors", "limit", "d"];

	constructor() {
		super();
	}

	async connectedCallback() {
		console.log("hn-query connectedCallback");
		await this.fetchQuery();
	}

	async attributeChangedCallback() {
		console.log("hn-query attributeChangedCallback");
		await this.fetchQuery();
	}

	async fetchQuery() {
		console.log("hn-query fetching query");
		const kind = this.getAttribute("kind");
		const authors = this.getAttribute("authors");
		const limit = this.getAttribute("limit");
		const event = this.getAttribute("event");
		const d = this.getAttribute("d");

		console.log(
			`hn-query... kind: ${kind}, authors: ${authors}, limit: ${limit}, event: ${event}, d: ${d}`
		);

		let events: NDKEvent[] = [] as NDKEvent[];

		// If there's an event we just fetch that and ignore the other params
		if (event) {
			const e = await ndk.fetchEvent({
				ids: [event],
			});
			if (e) {
				events.push(e as NDKEvent);
			}
		} else {
			// Kind
			if (!kind || isNaN(Number(kind))) {
				console.error("Invalid kind provided");
				return;
			}

			let parsedKind = Number(kind);

			console.log("parsedKind", parsedKind);

			// Authors
			let authorsArray: string[] = [];

			if (authors?.startsWith("[") && authors?.endsWith("]")) {
				console.log("authors is an array");
				authorsArray = JSON.parse(authors);
			} else {
				if (authors) {
					authorsArray.push(authors);
				}
			}

			if (authorsArray?.length === 0) {
				console.warn("No authors provided");
			} else {
				console.log("authorsArray", authorsArray);
				// Convert all the authors into hexpubs
				authorsArray = authorsArray.map((a: string) => {
					return pubkeyToHexpub(a);
				});
			}

			// Limit (defaults to 1)
			let parsedLimit = 1;

			if (limit && !isNaN(Number(limit))) {
				// TODO: limit isn't working?
				console.log("limit is a number: ", limit);
				parsedLimit = Number(limit);
			}

			const query: {
				kinds?: number[];
				authors?: string[];
				limit?: number;
				"#d"?: string[];
			} = {};

			if (parsedKind !== undefined && !isNaN(parsedKind)) {
				query.kinds = [parsedKind];
			}

			if (authorsArray.length > 0) {
				query.authors = authorsArray;
			}

			if (d) {
				query["#d"] = [d];
			}

			try {
				if (parsedLimit === 1) {
					console.log("fetching single event with query: ", query);
					const event = await ndk.fetchEvent(query);
					if (!event) {
						console.error("No event found for this query: ", query);
						return;
					}
					events.push(event);
				} else {
					query.limit = parsedLimit;
					const eventsSet = await ndk.fetchEvents(query);
					if (eventsSet.size === 0) {
						console.error(
							"No events found for this query: ",
							query
						);
						return;
					}
					events = Array.from(eventsSet);
				}
			} catch (e) {
				console.error("Error fetching events", e);
			}
		}

		console.log("events", events);

		// See if we have an hn-element to hydrate
		const hnElement = this.querySelector("hn-element");

		// TODO: this is really inefficient
		// Ideally we're cloning the template and hydrating before adding it to the dom
		if (hnElement) {
			// Get the template metadata we need
			const templateId = hnElement.getAttribute("hn-template");

			if (!templateId) {
				console.error("No template provided for hn-element");
				return;
			}

			const [_npub, templateName] = parseTemplateString(templateId);

			// Delete the original hn-element so we can replace it with the hydrated version
			hnElement.remove();

			for (const event of events) {
				// Get the template name from the hn-element
				const ele = document.createElement(
					"hn-element"
				) as HyperNoteElement;
				ele.setAttribute("hn-template", templateId);

				// TODO dumb that I'm doing this here but it fixed it?
				ele.templateName = templateName;

				// TODO: how could this ever be null?
				const data = event?.rawEvent();
				ele.setAttribute("hn-event-data", JSON.stringify(data));

				this.appendChild(ele);
			}
			return;
		}

		// // If we don't have an hn-element, look to see if we have any children
		// const children = this.children;

		// if (children.length > 0) {
		// 	console.log("We have children");
		// 	// If we have children, we're going to wrap them in a new hn-element
		// 	// TODO: not handling multiple events here really

		// 	const existingChildren = Array.from(children);

		// 	// Delete the original children so we can replace it with the hydrated version
		// 	existingChildren.forEach((c) => {
		// 		c.remove();
		// 	});

		// 	for (const event of events) {
		// 		const ele = document.createElement(
		// 			"hn-element"
		// 		) as HyperNoteElement;
		// 		ele.setAttribute("hn-template", "none");
		// 		ele.templateName = "none";

		// 		const data = event?.rawEvent();
		// 		ele.setAttribute("hn-event-data", JSON.stringify(data));

		// 		this.appendChild(ele);
		// 	}
		// 	return;
		// }

		// If we have no children just put events in the dom inside a <pre> tag
		events.forEach((event) => {
			const pre = document.createElement("pre");

			// Add a style to the pre tag so it wraps
			pre.style.whiteSpace = "pre-wrap";
			pre.style.wordBreak = "break-word";

			pre.innerText = JSON.stringify(event?.rawEvent(), null, 2);
			this.replaceChildren(pre);
		});
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
		this.innerHTML = /* html */ `
            <a href="https://njump.me/${value}" target="_blank">${value}</a>
            `;
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

// First we register the special components
customElements.define("hn-a", HyperNoteAElement);
customElements.define("hn-time", HyperNoteTimeElement);
customElements.define("hn-img", HyperNoteImgElement);
customElements.define("hn-markdown", HyperNoteMarkdownElement);

// Then we register the hn-elements
customElements.define("hn-element", HyperNoteElement);
// Then we register the hn-query parent elements that will hydrate those elements
customElements.define("hn-query", HyperNoteQueryElement);

//
//
// Utility functions
//
//
function fromHTML(html: string) {
	// Process the HTML string.
	html = html.trim();
	if (!html) return null;

	// Then set up a new template element.
	const template = document.createElement("template");
	template.innerHTML = html;
	const result = template.content.firstChild;

	return result as HTMLTemplateElement;
}

function parseTemplateString(
	templateId: string | undefined | null
): [string, string] {
	// If there's no template, we can't do anything
	if (!templateId) {
		console.error("No template provided for hn-element");
		return ["", ""];
	}

	// Parse the template string. It should be formatted as:
	// `nostr:${npub}/${templateName}`
	const [n, templateString] = templateId.split(":");
	if (n !== "nostr") {
		console.error("Invalid template string. Should start with nostr:");
	}

	const [npub, templateName] = templateString.split("/");
	return [npub, templateName];
}

function processContent(content?: string) {
	if (!content) {
		return content;
	}
	try {
		return JSON.parse(content);
	} catch (e) {
		return content;
	}
}

function pubkeyToHexpub(pubkey: string): string {
	// Only decode if it's prefixed
	for (const prefix of prefixes) {
		if (pubkey.startsWith(prefix)) {
			const decoded = nip19.decode(pubkey).data.toString();
			return decoded;
		}
	}
	return pubkey;
}

function hydrateSpecialElements(
	shadowRoot: ShadowRoot,
	selector: string,
	event: NostrEvent,
	content: any
) {
	const elements = shadowRoot.querySelectorAll(selector);
	elements.forEach((element) => {
		const field = element.getAttribute("value");

		if (!field) {
			console.error(`No value provided for ${selector}`);
			return;
		}

		if (!content) {
			console.error(`No content provided for ${selector}`);
			return;
		}

		const fieldParts = field.split(".");

		// If the field isn't in the event or the content we need to look in the tags
		if (!event[field] && !content[fieldParts[1]]) {
			console.warn(`No field found for ${field}, looking in tags`);

			const tags = event.tags;
			console.log("tags", tags);
			// Tags are formatted as an array of ["key", "value"] arrays
			// We need to find the tag with the key we're looking for
			const tag = tags.find((t: string[]) => t[0] === field);
			if (tag) {
				element.setAttribute("value", tag[1]);
			}
		} else {
			if (fieldParts.length === 1) {
				// s.innerHTML = event[field];
				element.setAttribute("value", event[field]);
			}

			if (fieldParts.length === 2) {
				element.setAttribute("value", content[fieldParts[1]]);
				// s.innerHTML = content[fieldParts[1]];
			}
		}

		// // assuming content.key
		// // TODO: make this more robust
		// if (valueKey.includes(".")) {
		// 	const [_, key] = valueKey.split(".");
		// 	const value = content[key];
		// 	if (!value) {
		// 		console.error(`No value found for ${selector} ${valueKey}`);
		// 		return;
		// 	}
		// 	element.setAttribute("value", value.toString());
		// 	return;
		// } else {
		// 	const value = event[valueKey];
		// 	if (!value) {
		// 		console.error(`No value found for ${selector} ${valueKey}`);
		// 		return;
		// 	}
		// 	element.setAttribute("value", value.toString());
		// }
	});
}

// https://github.com/nostr-dev-kit/ndk/blob/master/ndk-svelte-components/src/lib/utils/markdown.ts
function markdownToHtml(content: string): string {
	marked.use(gfmHeadingId());

	// TODO: lol sanitize html again

	// eslint-disable-next-line no-misleading-character-class
	return marked.parse(
		content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, "")
	);
}

// const query = await ndk.fetchEvents({
//     kinds: [30023],
//     authors: ["0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33"],
// });

// console.log("query test", query);

const query = await ndk.fetchEvents({
	kinds: [1],
	authors: [
		"0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33",
	],
	// limit: 1
	// "#d": ["nsecBunker-0-10-z9l8tw"]
});

console.log("query test", query);

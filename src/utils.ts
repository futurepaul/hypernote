import NDK, { NDKEvent, NDKFilter, NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { NostrEvent, nip19 } from "nostr-tools";

// markdown stuff
import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { HyperNoteQueryElement } from "./hn";

const prefixes = [
	"nprofile",
	"nrelay",
	"nevent",
	"naddr",
	"nsec",
	"npub",
	"note",
];

// TODO LOL
// import sanitizeHtml from "sanitize-html";

//
// UTILS
//
export function ndkFilterFromAttributes(
	el: HyperNoteQueryElement
): NDKFilter | undefined {
	const kind = el.getAttribute("kind");
	const authors = el.getAttribute("authors");
	const limit = el.getAttribute("limit");
	const d = el.getAttribute("d");
	const a = el.getAttribute("a");
	const e = el.getAttribute("e");

	const query: {
		kinds?: number[];
		authors?: string[];
		limit?: number;
		"#d"?: string[];
		"#a"?: string[];
		"#e"?: string[];
	} = {};

	// Kind
	if (!kind || isNaN(Number(kind))) {
		console.error("Invalid kind provided");
		return;
	}

	let parsedKind = Number(kind);

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
		console.log("authorsArray hexpubs", authorsArray);
	}

	// Limit (defaults to 1)
	let parsedLimit = 1;

	if (limit && !isNaN(Number(limit))) {
		// TODO: limit isn't working?
		console.log("limit is a number: ", limit);
		parsedLimit = Number(limit);
	}

	query.limit = parsedLimit;

	if (parsedKind !== undefined && !isNaN(parsedKind)) {
		query.kinds = [parsedKind];
	}

	if (authorsArray.length > 0) {
		query.authors = authorsArray;
	}

	if (d) {
		query["#d"] = [d];
	}

	if (a) {
		query["#a"] = [a];
	}

	if (e) {
		query["#e"] = [e];
	}

	return query;
}

export async function fetchEventOrEvents(
	filter: NDKFilter | undefined,
	ndk: NDK
): Promise<NDKEvent[]> {
	if (!filter) {
		throw new Error("Invalid filter");
	}

	console.log("fetchEventOrEvents... filter", filter);

	let events: NDKEvent[] = [];

	if (filter?.limit === 1) {
		// remove the limit from the filter because ndk doesn't like it
		filter.limit = undefined;
		const event = await ndk.fetchEvent(filter);
		if (!event) {
			throw new Error(
				`No event found for this filter: ${JSON.stringify(filter)}`
			);
		}
		events = [event];
	} else {
		// TODO: wtf is going on with limit???
		const eventsSet = await ndk.fetchEvents(filter);
		console.log("filter eventsset", eventsSet, filter);
		if (eventsSet.size === 0) {
			throw new Error(`No events found for this filter: ${filter}`);
		}
		eventsSet.forEach((e) => {
			events.push(e);
		});

		// TODO: there has to be a smarter way to just get one
		if (filter.limit === 1) {
			events = [events[0]];
		}
	}

	console.log("events from filter", events, filter);

	return events;
}

export function pubkeyToHexpub(pubkey: string): string {
	// Only decode if it's prefixed
	for (const prefix of prefixes) {
		if (pubkey.startsWith(prefix)) {
			const decoded = nip19.decode(pubkey).data.toString();
			return decoded;
		}
	}
	return pubkey;
}

// Wrap wrapper around nodes
// Just pass a collection of nodes, and a wrapper element
export function wrapAll(nodes: NodeList, wrapper: HTMLElement) {
	// Cache the current parent and previous sibling of the first node.
	var parent = nodes[0].parentNode;
	var previousSibling = nodes[0].previousSibling;

	// Place each node in wrapper.
	//  - If nodes is an array, we must increment the index we grab from
	//    after each loop.
	//  - If nodes is a NodeList, each node is automatically removed from
	//    the NodeList when it is removed from its parent with appendChild.
	for (var i = 0; nodes.length - i; wrapper.firstChild === nodes[0] && i++) {
		wrapper.appendChild(nodes[i]);
	}

	// Place the wrapper just after the cached previousSibling,
	// or if that is null, just before the first child.
	var nextSibling = previousSibling
		? previousSibling.nextSibling
		: parent?.firstChild;
	parent?.insertBefore(wrapper, nextSibling || null);

	return wrapper;
}

export function processContent(content?: string) {
	if (!content) {
		return content;
	}
	try {
		return JSON.parse(content);
	} catch (e) {
		return content;
	}
}

export function hydrateSlots(
	slots: NodeListOf<HTMLSlotElement>,
	event: NDKEvent,
	content: any
) {
	console.log("slots", slots);
	slots.forEach((s) => {
		const field = s.getAttribute("name")!;
		const fieldParts = field.split(".");

		if (!field || !event || !content) {
			console.error("No field, event, or content found");
			// return;
		} else {
			// If the field isn't in the event or the content we need to look in the tags
			if (!event[field] && !content[fieldParts[1]]) {
				console.error(`No field found for ${field}, looking in tags`);

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
}

export function hydrateChildQueries(
	childQueries: NodeListOf<HyperNoteQueryElement>,
	event: NDKEvent,
	content: any
) {
	console.log("child queries", childQueries);
	childQueries.forEach((c) => {
		const authors = c.getAttribute("authors");

		// TODO: make this more generic for other fields and for content
		if (authors?.startsWith("#")) {
			// If the authors attribute starts with a #, it's a reference to a field in the event
			const field = authors.slice(1);
			console.log("authors field", field);
			c.setAttribute("authors", event[field]);
		}
	});
}

export function parseTemplateString(
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

export function templateFromHtml(html: string) {
	// Process the HTML string.
	html = html.trim();
	if (!html) return null;

	// Then set up a new template element.
	const template = document.createElement("template");
	template.innerHTML = html;
	const result = template.content.firstChild;

	return result as HTMLTemplateElement;
}

export function hydrateSpecialElements(
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
		// TODO: figure out how to get typescript to like this
		// @ts-expect-error
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
				// TODO: figure out how to get typescript to like this
				// @ts-expect-error
				element.setAttribute("value", event[field]);
			}

			if (fieldParts.length === 2) {
				element.setAttribute("value", content[fieldParts[1]]);
			}
		}
	});
}

async function loginWithNip07() {
	try {
		const signer = new NDKNip07Signer();
		return signer.user().then(async (user) => {
			if (user.npub) {
				return { user: user, npub: user.npub, signer: signer };
			}
		});
	} catch (e) {
		throw e;
	}
}

export async function login(ndk: NDK) {
	// const nsec = prompt("Enter your nsec key");
	// const user = nsec
	// const user = nsec ? await loginWithSecret(nsec) : undefined;
	const user = await loginWithNip07();
	ndk.signer = user?.signer;
}

// https://github.com/nostr-dev-kit/ndk/blob/master/ndk-svelte-components/src/lib/utils/markdown.ts
export function markdownToHtml(content: string): string {
	marked.use(gfmHeadingId());

	// TODO: lol sanitize html again

	// @ts-expect-error
	return marked.parse(
		content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, "")
	);
}

export async function registerHnElement(
	hnElement: Element,
	ndk: NDK
): Promise<HTMLTemplateElement | null> {
	// TODO: fetch a template from nostr

	const templateId = hnElement.getAttribute("id");
	let template: HTMLTemplateElement | null = null;

	if (templateId) {
		// document.querySelector(`hn-element#${templateId}`)?.remove();
		const existingTemplate = document.querySelector(
			`template#${templateId}`
		);
		if (existingTemplate) {
			return existingTemplate as HTMLTemplateElement;
		}
		if (!existingTemplate) {
			console.log("Registering hn-element", hnElement, templateId);
			const newTemplate = document.createElement("template");
			newTemplate.setAttribute("id", templateId);
			if (hnElement.shadowRoot) {
				newTemplate.innerHTML = hnElement.shadowRoot.innerHTML;
			} else {
				newTemplate.innerHTML = hnElement.innerHTML;
			}
			document.body.append(newTemplate);
			template = newTemplate;
		}
		return template;
	} else {
		console.error("No template id found for hn-element", hnElement);
		return null;
	}
}

export function getAllPubkeysFromEvent(event: NDKEvent): string[] {
	let pubkeys: string[] = [];

	event.tags.forEach((tag: string[]) => {
		if (tag[0] == "p") {
			pubkeys.push(tag[1]);
		}
	});

	return pubkeys;
}

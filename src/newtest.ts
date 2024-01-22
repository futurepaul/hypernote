import NDK, { NostrEvent } from "@nostr-dev-kit/ndk";
import "./style.css";
import { nip19 } from "nostr-tools";

// guest book
// * list filtered events
// * input for submitting new event tagged to the guestbook

// tumblr
// * list of custom embeds

// presentation
// * list of slides
// * how do we have a concept of "next" and "previous" slides?
// (should just be hyperlinks somehow)

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://pablof7z.nostr1.com",
		"wss://nostr-pub.wellorder.net",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

function hydrateFields(
	parent: ShadowRoot,
	event: NostrEvent,
	parsedContent?: any
) {
	console.log("hydrating fields", event);
	const hnFields = parent.querySelectorAll<HTMLElement>("[hn-field]");
	hnFields.forEach((field) => {
		const fieldName = field.getAttribute("hn-field")!;
		const fieldParts = fieldName.split(".");

		if (fieldParts.length === 1) {
			field.innerHTML = event[fieldName];
		}

		if (fieldParts.length === 2) {
			field.innerHTML = parsedContent[fieldParts[1]];
		}
	});
}

function hydrateSources(
	parent: ShadowRoot,
	event: NostrEvent,
	parsedContent?: any
) {
	console.log("hydrating sources", event);
	const hnSrcs = parent.querySelectorAll<HTMLElement>("[hn-src]");
	hnSrcs.forEach((src) => {
		const srcName = src.getAttribute("hn-src")!;
		const srcParts = srcName.split(".");

		if (srcParts.length === 1) {
			src.setAttribute("src", event[srcName]);
		}

		if (srcParts.length === 2) {
			src.setAttribute("src", parsedContent[srcParts[1]]);
		}
	});
}

function hydrateRefs(
	parent: ShadowRoot,
	event: NostrEvent,
	parsedContent?: any
) {
	const hnRefs = parent.querySelectorAll<HTMLElement>("[hn-ref]");
	hnRefs.forEach((ref) => {
		const refName = ref.getAttribute("hn-ref")!;
		const refParts = refName.split(".");

		// Make sure refName is a valid key of NostrEvent
		if (!Object.keys(event).includes(refName)) {
			return;
		}

		type EventKey = keyof NostrEvent;
		const eventKey = refName as EventKey;

		if (refParts.length === 1) {
			ref.setAttribute("href", `https://njump.me/${event[eventKey]}`);
		}

		if (refParts.length === 2) {
			ref.setAttribute("href", parsedContent[refParts[1]]);
		}
	});
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

async function handleQuery(queryEle: HTMLElement) {
	// Get the kind from the attribute
	const kind = queryEle.getAttribute("hn-kind");

	if (typeof kind !== "string" || kind === "" || isNaN(parseInt(kind))) {
		console.error("No kind", queryEle);
		throw new Error("No kind");
	}

	// Get the author from the attribute
	const author = queryEle.getAttribute("hn-author");
	if (!author) {
		throw new Error("No author");
	}

	let hexpubkey = "";

	if (author.startsWith("npub")) {
		let { data: hexpub } = nip19.decode(author);
		hexpubkey = hexpub.toString();
	} else {
		hexpubkey = author;
	}

	// Get the limit from the attribute
	let limit = queryEle.getAttribute("hn-limit");

	if (typeof limit !== "string" || limit === "" || isNaN(parseInt(limit))) {
		// Default limit is 1
		limit = "1";
	}

	const events = await ndk.fetchEvents({
		kinds: [parseInt(kind)],
		authors: [hexpubkey],
		limit: parseInt(limit),
	});

	if (!events) {
		// throw new Error("No profile event found");
		console.error("No events found for query", queryEle);
	}

	// For each event push a child element to the queryEle
	const elementName = queryEle.getAttribute("hn-use");

	queryEle.innerHTML = "";
	events?.forEach((event) => {
		const newEle = document.createElement(elementName || "div");
		newEle.setAttribute("hn-event", event.id.toString());
		console.log("storing hn-event-data");
		console.log(event.rawEvent());
		newEle.setAttribute(
			"hn-event-data",
			JSON.stringify(JSON.stringify(event.rawEvent()))
		);
		queryEle.appendChild(newEle);
	});
}

async function handleQueries() {
	// Find all the elements with a hn-query attribute
	const hnQueries = document.querySelectorAll<HTMLElement>("[hn-query]");

	// Do some dumb stuff to make sure we wait for all the promises to resolve
	const queryPromises: Promise<void>[] = [];

	hnQueries.forEach((queryEle) => {
		queryPromises.push(handleQuery(queryEle));
	});

	for await (const p of queryPromises) {
		await p;
	}

	console.log("done with query elements");
}

async function handleUse(useEle: HTMLElement) {
	const elementName = useEle.getAttribute("hn-use");

	const elementContent = useEle.innerHTML;

	// if the elementName is an event id then download and register it as an element
	// otherwise assume it's already registered

	// if elementName is exactly 67 chars we'll assume it's hn- + a event id
	const isEventId =
		elementName?.length === 67 && elementName?.startsWith("hn-");

	if (isEventId) {
		console.log("found event id", elementName);
	} else {
		console.log("found element name", elementName);
		return;
	}

	// trim the hn- prefix off the element name
	const elementNameNoPrefix = elementName?.slice(3);

	const hnElementEvent = await ndk.fetchEvent({
		ids: [elementNameNoPrefix || ""],
	});

	console.log("found element", hnElementEvent?.content);

	// create new html element from the content string
	const templateEle = document.createElement("template");
	templateEle.innerHTML = hnElementEvent?.content || "";
	templateEle.setAttribute("id", elementName || "");

	// append the template element to the body so we can use it
	document.body.appendChild(templateEle);

	// create a new element with the template element
	const newEle = document.createElement(elementName || "");

	// get the original id of the use element and set it
	const useEleId = useEle.getAttribute("id");
	if (useEleId) {
		newEle.setAttribute("id", useEleId);
	}

	// if the useEle has a hn-query attribute then place the new element inside the use element
	if (useEle.hasAttribute("hn-query")) {
		useEle.innerHTML = newEle?.innerHTML || "";
	} else {
		// otherwise replace the use element with the new element
		newEle.innerHTML = elementContent;
		useEle.replaceWith(newEle);
	}

	registerHnElement(elementName || "");
}

async function swapElementWithEvent(
	target: HTMLElement | ShadowRoot,
	eventId: string
) {
	const eventData = await ndk.fetchEvent({
		ids: [eventId],
	});

	if (!eventData) {
		console.log("No event data");
		return;
	}

	target.innerHTML = eventData?.content || "";

	registerHnElement(eventId || "");
}

// Look up any hn-use elements and replace them with the element they reference
async function handleUses() {
	// Find all the elements with a hn-use attribute
	const hnUses = document.querySelectorAll<HTMLElement>("[hn-use]");

	// Do some dumb stuff to make sure we wait for all the promises to resolve
	const queryPromises: Promise<void>[] = [];

	hnUses.forEach((useEle) => {
		queryPromises.push(handleUse(useEle));
	});

	for await (const p of queryPromises) {
		await p;
	}

	console.log("done with use elements");
}

// Find all the hn-gets and add event listeners to them
async function handleGets() {
	const hnGets = document.querySelectorAll<HTMLElement>("[hn-get]");
	hnGets.forEach((get) => {
		const getEventId = get.getAttribute("hn-get")!;
		const trigger = get.getAttribute("hn-trigger") || "click";
		const target = get.getAttribute("hn-target") || "this";

		const targetEle = (
			target === "this" ? get : document.querySelector(target)
		) as HTMLElement | ShadowRoot | null;

		console.log("target", targetEle);

		get.addEventListener(trigger, async () => {
			console.log("clicked");
			await swapElementWithEvent(targetEle!, getEventId);
		});
	});
}

function registerHnElement(id: string) {
	console.log("registering hn element", id);
	customElements.define(
		id,
		class extends HTMLElement {
			constructor() {
				super();
				this.attachShadow({ mode: "open" });
				const template = document.getElementById(
					id
				) as HTMLTemplateElement;
				this.shadowRoot?.appendChild(template?.content.cloneNode(true));
			}

			static get observedAttributes() {
				return ["hn-loading", "hn-event-data"];
			}

			async connectedCallback() {
				// If we already have hn-event-data set we don't have to bother fetching it ourselves
				const eventData = this.getAttribute("hn-event-data");
				const eventId = this.getAttribute("hn-event");

				if (eventData) {
					console.log("Didn't have to fetch event:", eventId);
					this.render();
					return;
				}

				if (!eventId) {
					console.log("No event id");
					return;
				}

				await this.fetchEvent(eventId);
			}
			get eventData() {
				return JSON.parse(this.getAttribute("hn-event-data") || "{}");
			}
			set eventData(v: string) {
				this.setAttribute("hn-event-data", JSON.stringify(v));
			}
			disconnectedCallback() {}
			attributeChangedCallback(
				_attrName: string,
				_oldVal: string,
				_newVal: string
			) {
				this.render();
			}

			get loading() {
				console.log(
					"loading status: ",
					this.getAttribute("hn-loading")
				);
				return JSON.parse(this.getAttribute("hn-loading") || "false");
			}
			set loading(v) {
				this.setAttribute("hn-loading", JSON.stringify(v));
			}

			async fetchEvent(id: string) {
				this.loading = true;
				const eventData = await ndk.fetchEvent({
					ids: [id],
				});

				console.log(eventData?.rawEvent());

				if (eventData?.rawEvent()) {
					this.eventData = JSON.stringify(eventData.rawEvent());
				}
				this.loading = false;
			}

			processContent(content?: string) {
				if (!content) {
					return content;
				}
				try {
					return JSON.parse(content);
				} catch (e) {
					return content;
				}
			}

			render() {
				if (this.loading === true || this.eventData === "{}") {
					console.log("loading");
					this.innerHTML = `<strong>Loading inside render...</strong>`;
					return;
				}
				const root = this.shadowRoot;

				if (!root) {
					console.log(
						"I don't know why we wouldn't have a shadow root"
					);
					return;
				}

				const data = JSON.parse(this.eventData);
				console.log("parsed data: ", data);

				let content = processContent(data.content);
				hydrateFields(this.shadowRoot, data, content);
				hydrateSources(this.shadowRoot, data, content);
				hydrateRefs(this.shadowRoot, data, content);
			}
		}
	);
}

// registerHnElement("note-basic");
// registerHnElement("profile-basic");

const templateIds = new Set<string>();

const templateElements =
	document.querySelectorAll<HTMLTemplateElement>("template");
templateElements.forEach((template) => {
	const id = template.getAttribute("id");
	if (!id) {
		return;
	}
	templateIds.add(id);
});

console.log(templateIds);

templateIds.forEach((id) => {
	registerHnElement(id);
});

await handleUses();
await handleQueries();
await handleGets();

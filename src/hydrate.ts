import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

export async function hydrate(ndk: NDK) {
	// First we find all the hn-use elements, fetch their events, and put them in the page
	const hnUses = document.querySelectorAll<HTMLElement>("[hn-use]");

	// Do some dumb stuff to make sure we wait for all the promises to resolve
	let hnUsePromises: Promise<void>[] = [];

	hnUses.forEach((ele) => {
		hnUsePromises.push(replaceHnUse(ele, ndk));
	});

	for await (const hnUsePromise of hnUsePromises) {
		await hnUsePromise;
	}

	console.log("done with hnUses");

	// Find all the "parent" elements with the hn-kind attribute
	const hnParents = document.querySelectorAll<HTMLElement>("[hn-kind]");

	let hnParentsPromises: Promise<void>[] = [];

	hnParents.forEach((ele) => {
		hnParentsPromises.push(handleKind(ele, ndk));
	});

	for await (const hnParentsPromise of hnParentsPromises) {
		await hnParentsPromise;
	}

	console.log("done with hnParents");
}

async function replaceHnUse(ele: HTMLElement, ndk: NDK) {
	const useKind = ele.getAttribute("hn-use");
	if (typeof useKind !== "string" || useKind === "") {
		throw new Error("No kind");
	}

	console.log("hn-use: ", useKind);

	const hnElementEvent = await ndk.fetchEvent({
		ids: [useKind],
	});

	console.log(hnElementEvent?.content);

	// replace ele with the hnElementEvent content
	ele.outerHTML = hnElementEvent?.content || "";
	console.log("replaced ele with hnElementEvent content");
}

async function handleKind(hnParent: HTMLElement, ndk: NDK) {
	// Get the kind from the attribute
	const kind = hnParent.getAttribute("hn-kind");

	if (typeof kind !== "string" || kind === "" || isNaN(parseInt(kind))) {
		throw new Error("No kind");
	}

	// Get the author from the attribute
	const author = hnParent.getAttribute("hn-author");
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
	let limit = hnParent.getAttribute("hn-limit");

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
		throw new Error("No profile event found");
	}

	console.log(events);

	events.forEach((event) => {
		let content = processContent(event.content);
		const hnClone = hnParent.cloneNode(true) as HTMLElement;
		hydrateFields(hnClone, event, content);
		hydrateSources(hnClone, event, content);
		hnParent.parentNode?.append(hnClone);
	});

	// Remove the original hnParent
	hnParent.remove();
}

export function hydrateFields(
	parent: HTMLElement,
	event: NDKEvent,
	parsedContent?: any
) {
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

export function hydrateSources(
	parent: HTMLElement,
	event: NDKEvent,
	parsedContent?: any
) {
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

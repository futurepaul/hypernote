// @ts-nocheck
import NDK, {
	NDKEvent,
	NDKNip07Signer,
	NDKPrivateKeySigner,
} from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

class HNElement extends NDKEvent {
	constructor(ndk: NDK | undefined, dTagName: string) {
		super(ndk, undefined);

		// The kind of the HyperNoteElement event
		this.kind = 2616;

		const hexpub = this.ndk?.signer?.user().then((user) => {
			if (user.pubkey) {
				return user.pubkey;
			}
		});

		console.log("hexpub", hexpub);

		// ["a", <kind integer>:<32-bytes lowercase hex of a pubkey>:<d tag value>]

		// const aTag = ["a", `2616:${hexpub}:${dTagName}`];

		let tag = ["d", dTagName];
		this.tags.push(tag);
		// console.log("is replaceable", this.isReplaceable());

		console.log(this.rawEvent());

		// this.toNostrEvent();

		// The kind that this element accepts
		// let tag = ["query", kind.toString()];

		// Optional, if this element expects an author for the query
		// if (author) {
		// 	tag.push("author");
		// }
		// this.tags.push(tag);
		console.log("replaceable d tag", this.replaceableDTag());
	}
}

async function createHnElementEvent(
	ndk: NDK,
	dtagName: string,
	content: string
) {
	if (!ndk.signer) {
		throw new Error("No signer");
	}
	if (!dtagName || !content) {
		throw new Error("Missing dtagName or content");
	}
	// ["a", `32616:${user?.pubkey}:${dtagName}`],
	// const user = await ndk.signer?.user();
	const event = new NDKEvent(ndk);
	event.kind = 32616;
	event.content = content;
	event.tags.push(["d", dtagName]);

	// event.toNostrEvent();
	console.log(event.rawEvent());
	console.log("replaceable d tag", event.replaceableDTag());

	return event;
}

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

const kind32616Events = await ndk.fetchEvents({
	kinds: [32616 as number],
	authors: [
		"0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33",
	],
	// "#d": [],
	// tags: [["d", "test9"]]
});

export async function loginWithSecret(skOrNsec: string) {
	try {
		let privkey = skOrNsec;

		if (privkey.substring(0, 4) === "nsec") {
			privkey = nip19.decode(privkey).data as string;
		}

		const signer = new NDKPrivateKeySigner(privkey);
		return signer.user().then(async (user) => {
			if (user.npub) {
				return {
					user: user,
					npub: user.npub,
					sk: privkey,
					signer: signer,
				};
			}
		});
	} catch (e) {
		throw e;
	}
}

export async function loginWithNip07() {
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

export async function login() {
	// const nsec = prompt("Enter your nsec key");
	// const user = nsec
	// const user = nsec ? await loginWithSecret(nsec) : undefined;
	const user = await loginWithNip07();
	ndk.signer = user?.signer;
}

export async function publishSnippet(snippet: string, name: string) {
	// const element = new HNElement(ndk, name);
	const element = await createHnElementEvent(ndk, name, snippet.trim());
	// element.content = snippet.trim();
	await element.publish();
	console.log("published: ", element.id);
	return element.id;
}

export async function signSnippet(snippet: string) {
	// @ts-expect-error
	const element = new HNElement(ndk, 1, true);
	element.content = snippet.trim();
	await element.sign();
	console.log("signed: ", element.id);
	return element.id;
}

const publishForm = document.querySelector("form#publish");

// add a submit handler to the form
publishForm?.addEventListener("submit", async (event) => {
	// prevent the form from submitting
	event.preventDefault();

	// get the submit data
	const formData = new FormData(publishForm as HTMLFormElement);
	console.log(Object.fromEntries(formData));

	if (formData.get("content") === "") {
		alert("Please enter some content");
		return;
	}

	if (formData.get("name") === "") {
		alert("Please enter a name");
		return;
	}

	await login();

	const id = await publishSnippet(
		formData.get("content") as string,
		formData.get("name") as string
	);

	const pre = document.querySelector("pre#publishid");
	// @ts-expect-error
	pre.innerHTML = id;

	// clear the form
	// @ts-expect-error
	publishForm.content.value = "";
});

const justIdForm = document.querySelector("form#justid");

// add a submit handler to the form
justIdForm?.addEventListener("submit", async (event) => {
	// prevent the form from submitting
	event.preventDefault();

	// get the submit data
	const formData = new FormData(justIdForm as HTMLFormElement);
	console.log(Object.fromEntries(formData));

	await login();

	const id = await signSnippet(formData.get("content") as string);

	const pre = document.querySelector("pre#eventid");
	// @ts-expect-error
	pre.innerHTML = id;

	// clear the form
	// @ts-expect-error
	justIdForm.content.value = "";
});

for (const event of kind32616Events) {
	const pre = document.createElement("pre");
	console.log(event.rawEvent());
	pre.innerText = JSON.stringify(event.rawEvent(), null, 2);
	document.body.appendChild(pre);
}

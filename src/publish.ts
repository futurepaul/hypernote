import NDK, {
	NDKEvent,
	NDKNip07Signer,
	NDKPrivateKeySigner,
} from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

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

console.log("Checking for window.nostr...", window.nostr);
const hexpub = await window.nostr?.getPublicKey();
console.log("Got hexpub:", hexpub);

if (!hexpub) {
	console.log("No hexpub found, showing alert");
	alert(
		"This page requires a Nostr extension to work. Make sure to approve some stuff and reload the page."
	);
}

// Only fetch events if we have a hexpub
let kind32616Events: NDKEvent[] = [];
if (hexpub) {
	const events = await ndk.fetchEvents({
		kinds: [32616 as number],
		authors: [hexpub],
	});
	kind32616Events = Array.from(events);
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

	const event = new NDKEvent(ndk);
	event.kind = 32616;
	event.content = content;
	event.tags.push(["d", dtagName]);

	console.log(event.rawEvent());
	console.log("replaceable d tag", event.replaceableDTag());

	return event;
}

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
	const element = await createHnElementEvent(ndk, name, snippet.trim());
	await element.publish();
	console.log("published: ", element.id);
	return element.id;
}

export async function signSnippet(snippet: string) {
	const event = new NDKEvent(ndk);
	event.kind = 32616;
	event.content = snippet.trim();
	await event.sign();
	console.log("signed: ", event.id);
	return event.id;
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

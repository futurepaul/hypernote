import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { HNElement } from "./kind2616";
import { nip19 } from "nostr-tools";

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://pablof7z.nostr1.com",
		"wss://nostr-pub.wellorder.net",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

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

export async function login() {
	const nsec = prompt("Enter your nsec key");
	const user = nsec ? await loginWithSecret(nsec) : undefined;
	ndk.signer = user?.signer;
}

export async function publishSnippet(snippet: string) {
	const element = new HNElement(ndk, 1, true);
	element.content = snippet.trim();
	await element.publish();
	console.log("published: ", element.id);
	return element.id;
}

export async function signSnippet(snippet: string) {
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

	await login();

	const id = await publishSnippet(formData.get("content") as string);

	const pre = document.querySelector("pre#publishid");
	pre.innerHTML = id;

	// clear the form
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
	pre.innerHTML = id;

	// clear the form
	justIdForm.content.value = "";
});

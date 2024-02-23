// @ts-nocheck
import NDK, { NDKEvent, NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

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

const hexpub = await window.nostr?.getPublicKey();

if (!hexpub) {
	alert(
		"This page requires a Nostr extension to work. Make sure to approve some stuff and reload the page."
	);
}

export default {};

function loginWithNip07() {
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

async function login() {
	const user = await loginWithNip07();
	ndk.signer = user?.signer;
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

async function createLongformEvent(
	ndk: NDK,
	dtagName: string,
	content: string,
	title: string,
	summary: string,
	image: string
) {
	if (!ndk.signer) throw new Error("No signer");
	if (!dtagName) throw new Error("Missing dtagName");
	if (!content) throw new Error("Missing content");
	if (!title) throw new Error("Missing title");
	if (!summary) throw new Error("Missing summary");
	if (!image) throw new Error("Missing image");

	const event = new NDKEvent(ndk);
	event.kind = 30023;
	event.content = content;

	event.tags.push(["d", dtagName]);
	event.tags.push(["title", title]);
	event.tags.push(["summary", summary]);
	event.tags.push(["image", image]);

	console.log(event.rawEvent());
	console.log("replaceable d tag", event.replaceableDTag());

	return event;
}

const form = document.querySelector("form#guestbook-form");

// add a submit handler to the form
form?.addEventListener("submit", async (event) => {
	// prevent the form from submitting
	event.preventDefault();

	await login();

	// get the submit data
	const formData = new FormData(form as HTMLFormElement);
	console.log(Object.fromEntries(formData));

	const theCss = formData.get("css") as string;
	const pageSlug = formData.get("slug") as string;
	const title = formData.get("title") as string;
	const summary = formData.get("summary") as string;
	const content = formData.get("content") as string;
	const freestyle = formData.get("freestyle") as string;
	const image = formData.get("image") as string;

	const hydrated = hydrateTemplate({
		theCss,
		authorHexpub: hexpub as string,
		pageSlug,
		freestyle,
	});

	// console.log(hydrated);

	const hnElementEvent = await createHnElementEvent(ndk, pageSlug, hydrated);
	const longformEvent = await createLongformEvent(
		ndk,
		pageSlug,
		content,
		title,
		summary,
		image
	);

	console.log(hnElementEvent.rawEvent());
	console.log(longformEvent.rawEvent());

	await hnElementEvent.publish();
	console.log("published: ", hnElementEvent.id);

	await longformEvent.publish();
	console.log("published: ", longformEvent.id);

	const npub = nip19.npubEncode(hexpub!);

	// set the innertext of the #result div with the built url
	const builtUrl = `https://hypernote.club/hn/${npub}/${pageSlug}`;
	const resultDiv = document.querySelector("#result") as HTMLDivElement;
	resultDiv.innerText = builtUrl;

	// clear the form by resetting all the fields
	// (form as HTMLFormElement).reset();
});

function hydrateTemplate(values: {
	theCss: string;
	authorHexpub: string;
	pageSlug: string;
	freestyle: string;
}) {
	const { theCss, authorHexpub, pageSlug, freestyle } = values;

	const guestbookTemplate = /*html*/ `
    <template id="${pageSlug}">
        <style>
            ${theCss}
        </style>
        <main>
            <hn-query authors="#" d="${pageSlug}" kind="30023">
                <hn-element id="top-stuff">
                    <hn-img value="image"></hn-img>
                    <h1><slot name="title"></slot></h1>
                    <hn-markdown value="content"></hn-markdown>
                </hn-element>
            </hn-query>
            <hn-a value="pubkey">Find Me On The Nostr</hn-a>
            <hn-query kind="0" authors="#">
                <hn-element
                    hn-template="nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/profile-basic"
                ></hn-element>
            </hn-query>
            ${freestyle}
            <hn-query authors="#" d="${pageSlug}" kind="30023">
                <hn-element id="summary-stuff">
                    <h2><slot name="summary"></slot></h2>
                </hn-element>
            </hn-query>
            <hn-form id="publish">
                <textarea
                    placeholder="sign my guestbook!"
                    name="content"
                    id="content"
                    cols="30"
                    rows="3"
                ></textarea>
                <input
                    type="hidden"
                    name="p"
                    value="${authorHexpub}"
                />
                <input
                    type="hidden"
                    name="a"
                    value='["30023:${authorHexpub}:${pageSlug}","","root"]'
                />
                <button type="submit">Sign The Guestbook</button>
            </hn-form>
            <hn-query
                kind="1"
                a="30023:${authorHexpub}:${pageSlug}"
                limit="10"
            >
                <hn-element
                    hn-template="nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/note-basic"
                ></hn-element>
            </hn-query>
        </main>
    </template>
    `;

	return guestbookTemplate;
}

const kind32616Events = await ndk.fetchEvents({
	kinds: [32616 as number],
	authors: [hexpub!],
});

for (const event of kind32616Events) {
	const pre = document.createElement("pre");
	// console.log(event.rawEvent());
	pre.innerText = JSON.stringify(event.rawEvent(), null, 2);
	document.body.appendChild(pre);
}

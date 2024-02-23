// This is normal js but I'm practicing so I can see if I can make hypernote capable of these things

import NDK, { NDKEvent, NDKNip07Signer } from "@nostr-dev-kit/ndk";
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

async function login() {
	// const nsec = prompt("Enter your nsec key");
	// const user = nsec
	// const user = nsec ? await loginWithSecret(nsec) : undefined;
	const user = await loginWithNip07();
	ndk.signer = user?.signer;
}

// Example string:
// {"url":"https://github.com/benthecarman/wasm-plugins/releases/download/v0.1.0/even_block_hash.wasm", "checksum": "4f46a30d54cf84ecab68142c5d10999a89aeed819126d3eda8bef95180ae35c2", "function": "is_latest_block_hash_even", "input": "", "time": 1000}

export {};

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

document
	.querySelector("form#dvmrequest")
	?.addEventListener("submit", async (event) => {
		event.preventDefault();

		console.log("Form submitted");

		const data = new FormData(
			document.querySelector("form#dvmrequest") as HTMLFormElement
		);

		const entries = Object.fromEntries(data);

		try {
			if (entries["kind"] === "5600") {
				console.log("This is a 5600 request");
				if (entries["i"] === "") {
					throw new Error("No data provided");
				}

				const parsed = JSON.parse(entries["i"].toString());

				console.log(parsed);

				const nostrEvent = new NDKEvent(ndk);
				nostrEvent.kind = 5600;
				nostrEvent.content = "";
				nostrEvent.tags.push(["i", JSON.stringify(parsed)]);

				await login();

				await nostrEvent.publish();

				const id = nostrEvent.id;

				const formResult = document.querySelector("#dvmresult");

				if (formResult) {
					const resultTemplate = `
                    <div id="dvmresultid">${id}</div>
                    <h2>Original Event</h2>
                    <hn-query event="${id}"></hn-query>
                    <h2>7000 Query</h2>
                    <hn-query kind="7000" e="${id}" limit="1"></hn-query>
                    <h2>6600 Query</h2>
                    <hn-query kind="6600" e="${id}" limit="1"></hn-query>
                    `;

					formResult.innerHTML = resultTemplate;

					// Find the refreshresult button
					const refreshButton =
						document.querySelector("#refreshresult");

					if (refreshButton) {
						refreshButton.addEventListener("click", () => {
							document.querySelector("#dvmresultid")?.remove();
							document.querySelector("hn-query[event]")?.remove();
							document
								.querySelector('hn-query[kind="7000"]')
								?.remove();
							document
								.querySelector('hn-query[kind="6600"]')
								?.remove();

							formResult.innerHTML = resultTemplate;
						});
					}
				}
			}
		} catch (e) {
			console.error(e);
		}

		console.log();
	});

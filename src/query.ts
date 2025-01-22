import NDK from "@nostr-dev-kit/ndk";
import { fetchEventOrEvents } from "./utils";

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

// "[\"REQ\",\"kinds:30023-limit,au-982\",{\"kinds\":[30023],\"authors\":[\"0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33\"],\"#d\":[\"my-guestbook\"]}]" = $1

const filter = {
	kinds: [6600],
	"#e": ["a347c6eb3d1a8f799c5bca0e1deae75480ceb4c1faad0ed1a9ebdcf55064fe89"],
	// authors: ["0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33"],
	limit: 1
};

const events = await fetchEventOrEvents(filter, ndk);

// type 

for (const event of events) {
	console.log(event.rawEvent())
}

// Write events to JSON file
// const eventsJson = JSON.stringify(events.map(e => e.rawEvent()), null, 2);
// await Bun.write("kind-5600.json", eventsJson);

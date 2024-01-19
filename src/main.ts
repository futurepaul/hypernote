import "./style.css";
import NDK from "@nostr-dev-kit/ndk";
import { hydrate } from "./hydrate";

const ndk = new NDK({
	explicitRelayUrls: [
		"wss://pablof7z.nostr1.com",
		"wss://nostr-pub.wellorder.net",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

await hydrate(ndk);

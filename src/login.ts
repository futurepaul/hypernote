import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

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

export async function login(ndk: NDK) {
	const nsec = prompt("Enter your nsec key");
	const user = nsec ? await loginWithSecret(nsec) : undefined;
	ndk.signer = user?.signer;
}

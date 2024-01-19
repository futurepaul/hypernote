import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";

export class HNElement extends NDKEvent {
	constructor(ndk: NDK | undefined, kind: number, author?: boolean) {
		super(ndk, undefined);

		// The kind of the HyperNoteElement event
		this.kind = 2616;

		// The kind that this element accepts
		let tag = ["query", kind.toString()];

		// Optional, if this element expects an author for the query
		if (author) {
			tag.push("author");
		}
		this.tags.push(tag);
	}
}

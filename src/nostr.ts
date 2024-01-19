// const myFirstKind2616 = new HNElement(ndk, 1, true);

import { HNElement } from "./kind2616";

// myFirstKind2616.content = noteSnippet;
export async function publishElement(element: HNElement) {
	const result = await element.publish();
	console.log(result);
	console.log(element.id);
}

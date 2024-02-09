import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";

import {
	fetchEventOrEvents,
	getAllPubkeysFromEvent,
	hydrateSpecialElements,
	login,
	markdownToHtml,
	ndkFilterFromAttributes,
	parseTemplateString,
	processContent,
	registerHnElement,
	wrapAll,
} from "./utils";

const ndk = new NDK({
	explicitRelayUrls: [
		// "wss://pablof7z.nostr1.com",
		// "wss://nostr-pub.wellorder.net",
		// "wss://nos.lol",
		"wss://offchain.pub",
		"wss://relay.damus.io",
	],
	enableOutboxModel: false,
});

await ndk.connect(6000);

export class HyperNoteQueryElement extends HTMLElement {
	queryResult: NDKEvent[] = [];
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(this.nodeName, "\t\t\t", ...args);
	}

	static observedAttributes = ["kind", "authors", "limit", "d", "e", "debug"];

	constructor() {
		super();
	}

	async connectedCallback() {
		this.log("connectedCallback");
		try {
			await this.fetchQuery();
		} catch (e) {
			console.error("Error fetching query", e);
		}
	}

	async attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		if (oldValue === newValue) return;
		this.log("attributeChangedCallback", name, oldValue, newValue);

		if (
			typeof newValue === "string" &&
			typeof oldValue === "string" &&
			oldValue.startsWith("#")
		) {
			try {
				await this.fetchQuery();
			} catch (e) {
				console.error("Error fetching query", e);
			}
		}
	}

	async fetchQuery() {
		// TODO: need to not crash if a bad value is passed somewhere here
		const kind = this.getAttribute("kind");
		const authors = this.getAttribute("authors");
		const limit = this.getAttribute("limit");
		const event = this.getAttribute("event");
		const d = this.getAttribute("d");
		const a = this.getAttribute("a");
		const e = this.getAttribute("e");

		if (authors?.startsWith("#")) {
			console.warn("Authors starts with #, it's a reference to a field");
			return;
		}

		this.log(
			`fetchQuery... kind: ${kind}, authors: ${authors}, limit: ${limit}, event: ${event}, d: ${d}, a: ${a}, e: ${e}`
		);

		try {
			// TODO: validate that the event is a valid hexpub
			if (event) {
				const e = await ndk.fetchEvent(
					{
						ids: [event],
					},
					{
						closeOnEose: true,
					}
				);
				if (e) {
					this.queryResult = [e as NDKEvent];
				}
				return;
			} else {
				const filter = ndkFilterFromAttributes(this);
				console.log("filter", filter);

				this.queryResult = await fetchEventOrEvents(filter, ndk);
			}
		} catch (e) {
			console.error("fetching event error", e);
		}

		await this.render();
	}

	async render() {
		this.log("render");

		console.log("this.queryResult", this.queryResult);

		const firstChild = this.firstElementChild;

		if (!firstChild) {
			console.error(
				"hn-query requires one hn-element or one hn-element child"
			);
			return;
		}

		const firstChildTagName = firstChild.tagName.toLowerCase();

		// TODO: more robust
		if (firstChildTagName === "hn-query") {
			const authors = firstChild.getAttribute("authors");

			if (authors?.startsWith("#")) {
				// Put the array of pubkeys from the tags in here
				if (this.queryResult.length === 0) {
					console.error(
						"Can't get authors from tags if there are no events"
					);
					return;
				}

				const pubkeys = getAllPubkeysFromEvent(this.queryResult[0]);

				// If we don't find a bunch of pubkeys we'll just do the one pubkey
				if (pubkeys.length === 0) {
					console.log("single pubkey");
					const pubkey = this.queryResult[0].pubkey;
					firstChild.setAttribute("authors", pubkey);
				} else {
					console.log("pubkeys", pubkeys);
					firstChild.setAttribute("authors", JSON.stringify(pubkeys));
				}

				// firstChild.setAttribute(
				// 	"authors",
				// 	JSON.stringify([
				// 		"de845999855e6457762af0101b2e957edef941d9f2190c1fec1108420f5f3ce4",
				// 	])
				// );
				// firstChild.render();
			}
			return;
		}

		if (firstChildTagName !== "hn-element") {
			console.error(
				"hn-query requires one hn-element or one hn-element child"
			);
			return;
		}

		let template: HTMLTemplateElement | null;

		try {
			template = await registerHnElement(firstChild, ndk);
		} catch (e) {
			console.error("error registering hn-element", e);
		}

		const templateId = firstChild.getAttribute("id");

		this.queryResult.forEach((event, i) => {
			console.log("cloning node");
			const clone = template?.content.cloneNode(true);
			console.log(`attempting to clone ${templateId}`, clone);
			const newElement = document.createElement("hn-element");
			newElement.attachShadow({ mode: "open" });
			newElement.shadowRoot?.appendChild(clone!);
			newElement.setAttribute("id", firstChild.getAttribute("id")!);
			newElement.setAttribute(
				"hn-event-data",
				JSON.stringify(event?.rawEvent())
			);
			this.appendChild(newElement);
			firstChild.remove();
		});

		if (this.hasAttribute("debug")) {
			const wrapperDiv = document.createElement("div");
			wrapperDiv.style.border = "1px solid red";

			const infoBanner = document.createElement("div");
			infoBanner.innerText = `hn-query: kind: ${this.getAttribute(
				"kind"
			)}, authors: ${this.getAttribute(
				"authors"
			)}, limit: ${this.getAttribute("limit")}, d: ${this.getAttribute(
				"d"
			)}, a: ${this.getAttribute("a")}, e: ${this.getAttribute(
				"e"
			)}, debug: ${this.getAttribute("debug")}`;
			infoBanner.style.backgroundColor = "gray";
			infoBanner.style.fontFamily = "monospace";

			this.insertBefore(infoBanner, this.firstChild);

			wrapAll(this.childNodes, wrapperDiv);
		}

		this.childNodes;
	}
}

class HyperNoteElement extends HTMLElement {
	queryResult: NDKEvent[] = [];
	templateName: string | undefined;
	// LOGGING
	// @ts-expect-error
	log(...args) {
		console.log(this.nodeName, "\t\t\t", ...args);
	}

	static observedAttributes = ["hn-event-data"];

	constructor() {
		super();
	}

	async connectedCallback() {
		this.log("connectedCallback");
		// TODO: is this cool to do?
		this.setAttribute("style", "display: hidden");

		setTimeout(() => {}, 0);

		const templateId = this.getAttribute("hn-template");

		const [npub, templateName] = parseTemplateString(templateId);

		if (!npub || !templateName) {
			console.error(
				"Invalid template string. Should be formatted as nostr:<npub>/<templateName>"
			);
		}
	}

	async attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		if (oldValue === newValue) return;
		this.log("attributeChangedCallback", name, oldValue, newValue);

		if (name === "hn-event-data" || name === "id") {
			this.render();
		}
	}

	render() {
		this.log("render");
		this.setAttribute("style", "display: revert");

		const event = JSON.parse(this.getAttribute("hn-event-data") || "{}");

		if (!event) {
			console.error("Tried to render without event data");
			return;
		}

		let content = processContent(event.content);

		let shadowRoot = this.shadowRoot;

		if (!shadowRoot) {
			const templateElement = document.querySelector(
				"#" + this.templateName
			) as HTMLTemplateElement;

			// Clone the template and add it to the dom
			const newShadow = this.attachShadow({ mode: "open" });
			newShadow.appendChild(templateElement.content.cloneNode(true));
			shadowRoot = newShadow;
		}

		// Find all the named slots
		const slots = shadowRoot.querySelectorAll("slot");
		console.log("slots", slots);

		console.log("hydrating slots", event);
		slots.forEach((s) => {
			const field = s.getAttribute("name")!;
			const fieldParts = field.split(".");

			if (!field || !event || !content) {
				console.error("No field, event, or content found");
				// return;
			} else {
				// If the field isn't in the event or the content we need to look in the tags
				if (!event[field] && !content[fieldParts[1]]) {
					console.error(
						`No field found for ${field}, looking in tags`
					);

					const tags = event.tags;
					console.log("tags", tags);
					// Tags are formatted as an array of ["key", "value"] arrays
					// We need to find the tag with the key we're looking for
					const tag = tags.find((t: string[]) => t[0] === field);
					if (tag) {
						s.innerText = tag[1];
					}
				} else {
					if (fieldParts.length === 1) {
						s.innerText = event[field];
					}

					if (fieldParts.length === 2) {
						s.innerText = content[fieldParts[1]];
					}
				}

				// Let's see what s looks like now
				console.log("hydrated slot element", s);
			}
		});

		// Find all the author attributes that are just a #
		const authorAttributes =
			shadowRoot.querySelectorAll("hn-query[authors]");
		authorAttributes.forEach((a) => {
			const authors = a.getAttribute("authors");
			if (authors?.startsWith("#")) {
				a.setAttribute("authors", event.pubkey);
			}
		});

		// this.hydrateLinks();

		hydrateSpecialElements(shadowRoot, "hn-a", event, content);
		hydrateSpecialElements(shadowRoot, "hn-time", event, content);
		hydrateSpecialElements(shadowRoot, "hn-img", event, content);
		hydrateSpecialElements(shadowRoot, "hn-markdown", event, content);
	}
}

class SpecialElement extends HTMLElement {
	name: string = "base-special-element";
	// LOGGING
	// @ts-expect-error

	log(...args) {
		console.log(
			this.nodeName,
			`${this.name}:${this.getAttribute(this.name)}`,
			"\t\t\t",
			...args
		);
	}

	static get observedAttributes() {
		return ["value"];
	}

	constructor() {
		super();
	}

	attributeChangedCallback(
		name: string,
		oldValue: unknown,
		newValue: unknown
	) {
		this.log(
			`attributeChangedCallback name:${name}, old:${oldValue}, new:${newValue}`
		);
		this.render();
	}

	connectedCallback() {
		console.log(`${this.name} connectedCallback`);
		this.render();
	}

	render() {
		const value = this.getAttribute("value");
		this.innerHTML = /* html */ `
            <pre>${this.name}: ${value}</pre>
            `;
	}
}

class HyperNoteAElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-a";
	}

	render() {
		const value = this.getAttribute("value");

		// See if we have an inner a tag already
		const innerA = this.querySelector("a");
		if (innerA) {
			// If we do, we'll just replace the href
			innerA.href = `https://njump.me/${value}`;
			return;
		} else {
			// If we don't, we'll create a new a tag
			const newEle = document.createElement("a");
			newEle.href = `https://njump.me/${value}`;
			newEle.innerHTML = this.innerHTML;
			this.replaceChildren(newEle);
		}
	}
}

class HyperNoteTimeElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-time";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-time");
			return;
		}

		if (isNaN(Number(value))) {
			console.error(
				"Invalid value provided for hn-time. Should be a unix timestamp"
			);
			return;
		}

		const date = new Date(Number(value) * 1000);

		this.innerHTML = /* html */ `
            <time datetime="${date.toISOString()}">${date.toLocaleString()}</time>
            `;
	}
}

class HyperNoteImgElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-img";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-img");
			return;
		}

		console.log("about to render image");

		this.innerHTML = /* html */ `
            <img src="${value}" />
            `;
	}
}

class HyperNoteMarkdownElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-markdown";
	}

	render() {
		const value = this.getAttribute("value");

		if (!value) {
			console.error("No value provided for hn-markdown");
			return;
		}

		this.innerHTML = /* html */ `
            <div>${markdownToHtml(value)}</div>
            `;
	}
}

class HyperNoteFormElement extends SpecialElement {
	constructor() {
		super();
		this.name = "hn-form";
	}

	render() {
		// Create a new form element with the same inner html
		const newForm = document.createElement("form");
		newForm.innerHTML = this.innerHTML;

		newForm?.addEventListener("submit", async (e) => {
			e.preventDefault();

			// get the submit data
			const formData = new FormData(newForm as HTMLFormElement);
			console.log(Object.fromEntries(formData));

			if (formData.get("content") === "") {
				alert("Please enter some content");
				return;
			}

			// TODO: don't hardcode the kind
			const nostrEvent = new NDKEvent(ndk);
			nostrEvent.kind = 1;
			nostrEvent.content = formData.get("content") as string;

			const p = formData.get("p") as string;
			if (p) {
				nostrEvent.tags.push(["p", p]);
			}

			const a = formData.get("a") as string;
			const aParsed = JSON.parse(a);
			console.log("aParsed", aParsed);
			if (aParsed && aParsed.length > 0 && Array.isArray(aParsed)) {
				nostrEvent.tags.push(["a", ...aParsed]);
			}

			console.log("nostrEvent", nostrEvent.rawEvent());

			await login(ndk);

			await nostrEvent.publish();

			window.location.reload();
		});

		console.log("rendering form", newForm);

		this.replaceChildren(newForm);
	}
}

const PUBKEYS_I_FOLLOW = [
	"19fefd7f39c96d2ff76f87f7627ae79145bc971d8ab23205005939a5a913bc2f",
	"988f12f72c4819b5d011ee70d881356a5ad16c9a1ca22a66530ac72eb1d501ea",
	"de845999855e6457762af0101b2e957edef941d9f2190c1fec1108420f5f3ce4",
	"a67e98faf32f2520ae574d84262534e7b94625ce0d4e14a50c97e362c06b770e",
	"f5bda68c3dcf79344beb1145f18ce5e75e3ff5c8140e9ec3bd1d4ae7ee6458e1",
	"b9ceaeeb4178a549e8b0570f348b2caa4bef8933fe3323d45e3875c01919a2c2",
	"703e26b4f8bc0fa57f99d815dbb75b086012acc24fc557befa310f5aa08d1898",
	"8fe3f243e91121818107875d51bca4f3fcf543437aa9715150ec8036358939c5",
	"3335d373e6c1b5bc669b4b1220c08728ea8ce622e5a7cfeeb4c0001d91ded1de",
	"9e22bc4d823db5f6eddc3c23b3720aa7e77a56e7ebf10b2a97f8ff1492796e79",
	"ec8f72ff2937c197cb0d032dae27bae073ae6a4e1bd2a8e2ef1578636b3595cb",
	"11b9a89404dbf3034e7e1886ba9dc4c6d376f239a118271bd2ec567a889850ce",
	"311b497635856767ff5c1cefa2b8c5c875ce184ae4876da9279e829ba01dd129",
	"5144fe88ff4253c6408ee89ce7fae6f501d84599bc5bd14014d08e489587d5af",
	"56a6b75373c8f7b93c53bcae86d8ffbaba9f2a1b38122054fcdb7f3bf645b727",
	"eae7edfdcb79f23157a1af919495464e49aa76a22e5a5667148f296c1585a879",
	"f2c96c97f6419a538f84cf3fa72e2194605e1848096e6e5170cce5b76799d400",
	"a6223de378ea5daad05577b87c9c07eda41b171b02465a6e64f9f4356f46025b",
	"e9c0a9c12e3a04edd79afc77d89b6c6413cc942ef9e61c51e51283cbe9db0c8f",
	"1bbd7fdf68eaf5c19446c3aaf63b39dd4a8e33548bc96f6bd239a4124d8f229e",
	"40e162e0a8d139c9ef1d1bcba5265d1953be1381fb4acd227d8f3c391f9b9486",
	"884704bd421721e292edbff42eb77547fe115c6ff9825b08fc366be4cd69e9f6",
	"885bfc2076f182973b045024459552332f6747772d95e1320f93126ebf1739c5",
	"2a2c0f22aac6fe3b557e5354d643598b2635a82ccd63c342d541fa571456b2da",
	"60a3a6b57cf954ae97c1ecd4c48c46e8b9b2476a13274fe2c73eb90f2cfe9879",
	"18730a5ef6d6cdc9d1ad5d2d9c193b3922668df7a49ddfc55bc6b66ea4753dcd",
	"647fcbfef88dd2347a4f69a296f0fd6a470f96eb1cd294066e2594e95fc9480d",
	"41108126409bf99cb77ff16fd53f4da2e53010b0dca04b0a53ebdf46eade37aa",
	"b9e76546ba06456ed301d9e52bc49fa48e70a6bf2282be7a1ae72947612023dc",
	"cd169bd8fbd5179e2a8d498ffc31d3ae0e40825ff2b8a85ea359c4455a107ca8",
	"056d6999f3283778d50aa85c25985716857cfeaffdbad92e73cf8aeaf394a5cd",
	"04918dfc36c93e7db6cc0d60f37e1522f1c36b64d3f4b424c532d7c595febbc5",
	"768a4ef8d0d17d7b46f62451ff8c8238dccc8d3d793e23971749413ba710b615",
	"a9434ee165ed01b286becfc2771ef1705d3537d051b387288898cc00d5c885be",
	"5b0e8da6fdfba663038690b37d216d8345a623cc33e111afd0f738ed7792bc54",
	"dc702ec09528f27b06ab44db2156c596618856f5281d47b185335fae6161dcaf",
	"a1808558470389142e297d4729e081ab8bdff1ab50d0ebe22ffa78958f7a6ab7",
	"a4dbfdc6e7e27e33b04e8009cf15dd1df35d62a9b258e70c38166871a577c47a",
	"bd1e19980e2c91e6dc657e92c25762ca882eb9272d2579e221f037f93788de91",
	"6313d3f5b6a58f36a769339b789a5df6cda177e86ebef495bf1202d17744d789",
	"4523be58d395b1b196a9b8c82b038b6895cb02b683d0c253a955068dba1facd0",
	"e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411",
	"e1ff3bfdd4e40315959b08b4fcc8245eaa514637e1d4ec2ae166b743341be1af",
	"cc9976d96708729c89027c1137340399ff511f7c741563b44a5b1fda7bb8508b",
	"e9e4276490374a0daf7759fd5f475deff6ffb9b0fc5fa98c902b5f4b2fe3bba2",
	"db506a8997fdddca7c82f00368f799ba05d4e923fe217e0de26e72fbafb18763",
	"1a5afb99a2c0b3a08a4a2aefc146ace0e9e76ca0e4b3e7472d3491c8035bafb1",
	"fd38f135ef675eac5e93d5b2a738c41777c250188031caf1dcf07b1687a1fe49",
	"7560e065bdfe91872a336b4b15dacd2445257f429364c10efc38e6e7d8ffc1ff",
	"da3620e685cee8d484a96947327fad921ab910a6e2a2f1abad4a2a891d3ddc6d",
	"c48e29f04b482cc01ca1f9ef8c86ef8318c059e0e9353235162f080f26e14c11",
	"883fea4c071fda4406d2b66be21cb1edaf45a3e058050d6201ecf1d3596bbc39",
	"d7b76d02c758a62a505e03bd5f5049aaee4e7e36283d273c7f6798912692df2b",
	"efc604553eb6c8c7b9a566d401e6ef60f03554a4b6d321ca21f50fe13a3f30bd",
	"c7eda660a6bc8270530e82b4a7712acdea2e31dc0a56f8dc955ac009efd97c86",
	"4d9c97a6000762b962e2cc680f3ebed6b502766dd841004869f5540e911f34ab",
	"59f7db369313971d4c9bd4abb1ccadb32b89d63b5556021c66646ac8a13f33a4",
	"1bbd0a5e2477ef7af680e5e51927bc86f3475317e63f5ee83c55402c6b18a8a2",
	"8f124a840f7d480bf28866c6de8b8eb68ae525ed674f851bb2d15b0ac2425d8c",
	"3f770d65d3a764a9c5cb503ae123e62ec7598ad035d836e2a810f3877a745b24",
	"30782a8323b7c98b172c5a2af7206bb8283c655be6ddce11133611a03d5f1177",
	"acedd3597025cb13b84f9a89643645aeb61a3b4a3af8d7ac01f8553171bf17c5",
	"3235036bd0957dfb27ccda02d452d7c763be40c91a1ac082ba6983b25238388c",
	"a3eb29554bd27fca7f53f66272e4bb59d066f2f31708cf341540cb4729fbd841",
	"4d62dd5e6ac55ae2405940f59f6f030a994ec2b3ecc5556c8dc542cce20e46dd",
	"645681b9d067b1a362c4bee8ddff987d2466d49905c26cb8fec5e6fb73af5c84",
	"c88f94f0a391b9aaa1ffefd645253b1a968b0a422a876ea48920a95d45c33f47",
	"a4b337df3f3cfee31e18e2a0a8a7a57cbe890611c2da9fa8d4ca056d93172679",
	"ff27d01cb1e56fb58580306c7ba76bb037bf211c5b573c56e4e70ca858755af0",
	"b66be78da89991544a05c3a2b63da1d15eefe8e9a1bb6a4369f8616865bd6b7c",
	"bd9672edf6e5e6fb41888e367ac09f5606a79730d4a6e37871edc93e569bcd05",
	"408f636bd26fcc5f29889033b447cb2411f60ab1b8a5fc8cb3842dab758fdeb5",
	"4f2de0548f7080ef3243478d9e719df1428f6168d17b488a06069190da1c48c7",
	"de7ecd1e2976a6adb2ffa5f4db81a7d812c8bb6698aa00dcf1e76adb55efd645",
	"997d4224222a7f928353dcf901e4902bec4d5bc1b79957aaa94cbfdc68435e7b",
	"3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
	"cc66fc089d1b81bd01dd741a3cded0d0b9762f2adc696a3c11c2ff1980aa74c9",
	"e7424ad457e512fdf4764a56bf6d428a06a13a1006af1fb8e0fe32f6d03265c7",
	"709bd2be88c1f020b36d0b1414fd92e7306e8b91612bef0b3e3e202189d608e0",
	"472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e",
	"46d7ef5268eadcbd2477450b0ce550c5f21d2926eb252d3aacc5d8e8ccf6680e",
	"40b9c85fffeafc1cadf8c30a4e5c88660ff6e4971a0dc723d5ab674b5e61b451",
	"5683ffc7ff8a732565135aad56cdff94ebacd9a616d1313aea8ad48a446bfe99",
	"e54c21c7ca38bbbf57a6b9fce46e5b33eda927da6dc90cf65239a2214d7e9087",
	"04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9",
	"fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52",
	"df173277182f3155d37b330211ba1de4a81500c02d195e964f91be774ec96708",
	"d8a2c33f2e2ff3a9d4ff2a5593f3d5a59e9167fa5ded063d0e49891776611e0c",
	"5c3ac592e4b12e62bdc7c975a2407f58484bf9c816d1c299f52f2469142ca38e",
	"726a1e261cc6474674e8285e3951b3bb139be9a773d1acf49dc868db861a1c11",
	"1e4c4fafe7b6627283e6061fe7f862f793ce004d835ba2b3e29e7a2504ac9dba",
	"17717ad4d20e2a425cda0a2195624a0a4a73c4f6975f16b1593fc87fa46f2d58",
	"fda0d1933d7e3f4120e4aeb9a27f96db2f28cc2724ef15a2c504866e45f68d39",
	"82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
	"eb02ec8d113f8ab1c569ff69cb7b6dded6a63e745c52979f36c8a8dbc41c3d48",
	"4d5ce768123563bc583697db5e84841fb528f7b708d966f2e546286ce3c72077",
	"971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b",
	"c060b31fe2bbb0be4d393bc7c40a80848a25b8f0e0f382cb5b49c37bf7476cb4",
	"1bc2e23bbbf8ace7de552d3206b753d2511fac600a971e509231f4688a05ecb3",
	"3839274afeb9eaa5182edbd422dc3664c58d17ae2b309d9ba35bcd8ceb9fff6b",
	"deba271e547767bd6d8eec75eece5615db317a03b07f459134b03e7236005655",
	"6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93",
	"58ead82fa15b550094f7f5fe4804e0fe75b779dbef2e9b20511eccd69e6d08f9",
	"852b885d24d4101f23b2597c20a1a834b01e6c4e47226a0b77075f4b0d2600d7",
	"22a0bf0c34aabdeb91aae41da85c91b18239ec2cbdb22dfda1f32fff5c2553fa",
	"d26f78e5954117b5c6538a2d6c88a2296c65c038770399d7069a97826eb06a95",
	"50d94fc2d8580c682b071a542f8b1e31a200b0508bab95a33bef0855df281d63",
	"c037a6897df86bfd4df5496ca7e2318992b4766897fb18fbd1d347a4f4459f5e",
	"efe5d120df0cc290fa748727fb45ac487caad346d4f2293ab069e8f01fc51981",
	"b5ba65fbb0221a32b6c14400f505cfdd3651d43938a248a9265a516ec0c54240",
	"1b11ed41e815234599a52050a6a40c79bdd3bfa3d65e5d4a2c8d626698835d6d",
	"87570647ca3b7549e66cb6c4bb8d197f5bc91de73b58eb1ade78c8ddd5fec7eb",
	"062b34e2d28177eecf16cb00206418c9fcb9b14e7fd814c809dda8f67bbdea8d",
	"c1fc7771f5fa418fd3ac49221a18f19b42ccb7a663da8f04cbbf6c08c80d20b1",
	"35b23cd02d2d75e55cee38fdee26bc82f1d15d3c9580800b04b0da2edb7517ea",
	"eaf27aa104833bcd16f671488b01d65f6da30163b5848aea99677cc947dd00aa",
	"aff9a9f017f32b2e8b60754a4102db9d9cf9ff2b967804b50e070780aa45c9a8",
	"11674b2d321fc24239b02afdf966c32e36594a6282bd7f3d4bcd12438558ab51",
	"543571ce6908daa3d3773741a45512f76aafe3fcd25bbae06ee45ea3b5e698cc",
	"5e5359da0518d38658df72e05cf2a2ff2e983d5498c71fb6db3c21c033dbaead",
	"35269ea605a7605d6ad6b31bef45cc6500b911aaf249146bd23105f9963bb3d4",
	"e2ccf7cf20403f3f2a4a55b328f0de3be38558a7d5f33632fdaaefc726c1c8eb",
	"874db6d2db7b39035fe7aac19e83a48257915e37d4f2a55cb4ca66be2d77aa88",
	"aac07d95089ce6adf08b9156d43c1a4ab594c6130b7dcb12ec199008c5819a2f",
	"efba4c3bc34558d20ff0a433dd81a0fbce0c3734d7b579d6d020d8629bbdcb79",
	"5fd693e61a7969ecf5c11dbf5ce20aedac1cea71721755b037955994bf6061bb",
	"9e1e498420bc7c35f3e3a78d20045b4c8343986dae48739759bccb2a27e88c53",
	"093af643fdbf95ea64e11bb955f319644fece73eb9e4a3b37577d8cfb93f73a6",
	"ad46db12ee250a108756ab4f0f3007b04d7e699f45eac3ab696077296219d207",
	"8b1348871a94e403d344ca48cb16f58a9da3501fe6c8ffae84c08ae1b0521cd7",
	"d2e9c44d343009c3857b83a54c63e9cd274202ec53e28ab5d30dec44fd0a64c7",
	"88dd3d492446e6df1a8837222e0f5248b39dfcf4733863b9586a97ac9346aacb",
	"9984188a6578eb513fddcf658f389dbd532e54b82b628ad36666f7aa8f731b79",
	"29fbc05acee671fb579182ca33b0e41b455bb1f9564b90a3d8f2f39dee3f2779",
	"3fdc638cb91862fb3dde16f7cc575eeba1006c52b0352b32862fcc81584ba8c7",
	"e6a9a4f853e4b1d426eb44d0c5db09fdc415ce513e664118f46f5ffbea304cbc",
	"f33c8a9617cb15f705fc70cd461cfd6eaf22f9e24c33eabad981648e5ec6f741",
	"9c163c7351f8832b08b56cbb2e095960d1c5060dd6b0e461e813f0f07459119e",
	"83e818dfbeccea56b0f551576b3fd39a7a50e1d8159343500368fa085ccd964b",
	"7be6f276e1adbb38c4228dd6ea6680ca2115d39bcc330904a4c0a3fa982eeb9d",
	"064de2497ce621aee2a5b4b926a08b1ca01bce9da85b0c714e883e119375140c",
	"d3d74124ddfb5bdc61b8f18d17c3335bbb4f8c71182a35ee27314a49a4eb7b1d",
	"b7c66ce6f7bbe034e96be54c2ffc0adf631a889abc0834ba1431171b67c489aa",
	"1760ae294616cbea60cafa59608f247fba8230c237ae26dc0e3fa8b58e7bfb0a",
	"db5bfe38c0d905cf2ff711a6a4acc00a903b5f8e450c7fdc0f986056422d1ea5",
	"15b5cf6cdf4fd1c02f28bcce0f197cafae4c8c7c66a3e2e23af9fe610875315e",
	"2779f3d9f42c7dee17f0e6bcdcf89a8f9d592d19e3b1bbd27ef1cffd1a7f98d1",
	"43a22be283a77d24a3fa218e063e782da195d1adb0edd528b88ac9ba1bebcdfe",
	"1577e4599dd10c863498fe3c20bd82aafaf829a595ce83c5cf8ac3463531b09b",
	"98315132d6ab8cfe404f3a8046b8336d545f1494b163b6ee6a6391c5aec248c9",
	"e22f6c280855623bbf4f720eed52213c9c298968344dcfd22d15173d46ce767b",
	"5c4bf3e548683d61fb72be5f48c2dff0cf51901b9dd98ee8db178efe522e325f",
	"cbf904c0702a361911c46d79379a6a502bc3bd0b4c56d25389e62d3ebf4a7db8",
	"5f69082cc20dbdd25b320eb0c3e79f3bf6a1c92e60623449cf3224b0fa11eda9",
	"bdbe1bdbc9b25a8d89d8fdaf0be1a0dcd837bac9691f597892903a5fdd86e27f",
	"34d2f5274f1958fcd2cb2463dabeaddf8a21f84ace4241da888023bf05cc8095",
	"000000000332c7831d9c5a99f183afc2813a6f69a16edda7f6fc0ed8110566e6",
	"59cacbd83ad5c54ad91dacf51a49c06e0bef730ac0e7c235a6f6fa29b9230f02",
	"1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b",
	"9279276bffb83cee33946e564c3600a32840269a8206d01ddf40c6432baa0bcb",
	"2590201e2919a8aa6568c88900192aa54ef00e6c0974a5b0432f52614a841ec8",
	"b7ed68b062de6b4a12e51fd5285c1e1e0ed0e5128cda93ab11b4150b55ed32fc",
	"090254801a7e8e5085b02e711622f0dfa1a85503493af246aa42af08f5e4d2df",
	"ac20203ec8219225b8a7eda96154c45f5775157e82a7d1fe95db1a988c51bc2d",
	"6c55a582d2998f8ae0d72bc6adf25ad72cfdaf75bd9f44f5607b2c47aa703a51",
	"2250f69694c2a43929e77e5de0f6a61ae5e37a1ee6d6a3baef1706ed9901248b",
	"91c9a5e1a9744114c6fe2d61ae4de82629eaaa0fb52f48288093c7e7e036f832",
	"e75692ec71174e698df1f3d1f5771855bcc4e6e568489d2eaad489d81064ace6",
	"cd6b2f16c7afb47570ab242e0cbe0b9da64e1e7c6978a23c5ef33d4bb4a1cf57",
	"9b0c5f5271c2dd4267d6127ab44738c5684c68ebb5e5b18cbb7b08f2a20b810a",
	"4d992bd1e12f77866334ce3fdfe20203799bfefb84b7ed5cd111290345157b5a",
	"cbc5ef6b01cbd1ffa2cb95a954f04c385a936c1a86e1bb9ccdf2cf0f4ebeaccb",
	"7b942c3ca017228ced5a46cd7dfb3f1e34686557994b282dcebe975657662e4d",
	"3d2e51508699f98f0f2bdbe7a45b673c687fe6420f466dc296d90b908d51d594",
	"7b3f7803750746f455413a221f80965eecb69ef308f2ead1da89cc2c8912e968",
	"6b0d4c8d9dc59e110d380b0429a02891f1341a0fa2ba1b1cf83a3db4d47e3964",
	"9579444852221038dcba34512257b66a1c6e5bdb4339b6794826d4024b3e4ce9",
	"e8d4a7509246d3382d8fdba16fba4cd890450d1946a01313fb3bd582129b963d",
	"7f4f672af0cb2e9263f525d68f3043c05c1e7a1ade5aaf4b89afc400c184579e",
	"8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168",
	"8967f290cc7749fd3d232fb7110c05db746a31fce0635aeec4e111ad8bfc810d",
	"a5bf66a4c585e247975da49272d07865b76133e4527656a0c0d5f80b84b4f6a5",
	"bd9eb657c25b4f6cda68871ce26259d1f9bc62420487e3224905b674a710a45a",
	"9bd9312a0057ed0c7fdc498237db2742deaf5f04b9076d6186f20e1368a87754",
	"25a2192dcf34c3be326988b5c9f942aa96789899d15b59412602854a8723e9e8",
	"3f503eef50d5b9f73af8d44ed380e4a3090e2c63631bffa9cd919bea38356a64",
	"b07d216f2f0422ec0252dd81a6513b8d0b0c7ef85291fbf5a85ef23f8df78fa7",
	"35d26e4690cbe1a898af61cc3515661eb5fa763b57bd0b42e45099c8b32fd50f",
	"02a11d1545114ab63c29958093c91b9f88618e56fee037b9d2fabcff32f62ea9",
	"eda96cb93aecdd61ade0c1f9d2bfdf95a7e76cf1ca89820c38e6e4cea55c0c05",
	"b3cc54443d605792dd71de3abcb7082328f7d187d85ceef77e047dd7ee22da38",
];

const query = await ndk.fetchEvents({
	kinds: [1],
	authors: PUBKEYS_I_FOLLOW,
});

console.log("query", query);

customElements.define("hn-a", HyperNoteAElement);
customElements.define("hn-time", HyperNoteTimeElement);
customElements.define("hn-img", HyperNoteImgElement);
customElements.define("hn-markdown", HyperNoteMarkdownElement);
customElements.define("hn-form", HyperNoteFormElement);

customElements.define("hn-query", HyperNoteQueryElement);
customElements.define("hn-element", HyperNoteElement);

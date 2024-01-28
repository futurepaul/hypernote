import NDK, { NostrEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
const prefixes = ["nprofile", "nrelay", "nevent", "naddr", "nsec", "npub", "note"];

const ndk = new NDK({
    explicitRelayUrls: [
        "wss://pablof7z.nostr1.com",
        "wss://nostr-pub.wellorder.net",
    ],
    enableOutboxModel: false,
});

await ndk.connect(6000);

class HyperNoteElement extends HTMLElement {
    // LOGGING
    // @ts-expect-error
    log(...args) {
        console.log(this.nodeName, `hn-template:${this.getAttribute("hn-template")}`, "\t\t\t", ...args);
    }

    templateName: string | undefined;

    static observedAttributes = ["hn-template", "hn-event", "hn-event-data"];

    constructor() {
        super();
    }

    async connectedCallback() {
        // LOGGING
        this.log("connectedCallback", this.innerHTML || "innerHTML not parsed yet");

        // be aware this.innerHTML is only available for PARSED elements
        // use setTimeout(()=>{...},0) if you do need this.innerHTML

        const templateId = this.getAttribute("hn-template");

        const [npub, templateName] = parseTemplateString(templateId);

        if (!npub || !templateName) {
            console.error("Invalid template string. Should be formatted as nostr:<npub>/<templateName>");
        }

        // If the template already exists no need to add it again
        // TODO: this check doesn't work, we fetch each time
        if (document.querySelector("#" + templateName)) {
            console.log(`Template ${templateName} already exists`)
            return;
        } else {
            console.log(`Fetching template ${templateName}`)
            const template = await this.fetchTemplate(npub, templateName);

            if (!template) {
                console.error("No template found");
                return;
            }

            // Add the template to the dom
            const templateElement = fromHTML(template);
            if (!templateElement) {
                console.error("Invalid template");
                return;
            }
            document.body.append(templateElement);
        }

        this.templateName = templateName;

        // If there's an event, fetch it and hydrate the element with the data
        // If we already have hn-event-data set we don't have to bother fetching it ourselves
        const eventData = this.getAttribute("hn-event-data");
        const eventId = this.getAttribute("hn-event");

        if (eventData) {
            console.log("Didn't have to fetch event:", eventId);
            this.render();
            return;
        }

        if (!eventId) {
            console.log("No event id");
            this.render();
            return;
        }

        const [_, id] = eventId.split(":");

        if (!id) {
            console.error("Invalid event id. It should start with nostr: and be a valid hex string");
        }

        await this.fetchEvent(id);
    }

    attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.log(`attributeChangedCallback name:${name}, old:${oldValue}, new:${newValue}`);
        this.render();

    }

    render() {
        if (!this.templateName) {
            console.error("Tried to render without a template name");
            return
        }

        const event = JSON.parse(this.getAttribute("hn-event-data") || "{}");

        if (!event) {
            console.error("Tried to render without event data");
            return
        }

        let content = processContent(event.content);

        let shadowRoot = this.shadowRoot;

        if (!shadowRoot) {
            const templateElement = document.querySelector("#" + this.templateName) as HTMLTemplateElement;

            // Clone the template and add it to the dom
            const newShadow = this.attachShadow({ mode: "open" });
            newShadow.appendChild(templateElement.content.cloneNode(true));
            shadowRoot = newShadow;
        }

        // Find all the named slots
        const slots = shadowRoot.querySelectorAll("slot");

        console.log("hydrating slots", event);
        slots.forEach((s) => {
            const field = s.getAttribute("name")!;
            const fieldParts = field.split(".");

            if (fieldParts.length === 1) {
                s.innerHTML = event[field];
            }

            if (fieldParts.length === 2) {
                s.innerHTML = content[fieldParts[1]];
            }
        });
    }

    async fetchEvent(id: string) {
        const eventData = await ndk.fetchEvent({
            ids: [id],
        });

        console.log(eventData?.rawEvent());

        if (eventData?.rawEvent()) {
            this.setAttribute("hn-event-data", JSON.stringify(eventData.rawEvent()));
            // this.eventData = JSON.stringify(eventData.rawEvent());
        }

        this.render();
    }

    async fetchTemplate(npub: string, templateName: string) {
        const hexpub = pubkeyToHexpub(npub);
        const events = await ndk.fetchEvents({
            kinds: [32616],
            authors: [
                hexpub
            ],
            "#d": [templateName],
        });

        if (events.size === 0) {
            console.error("No events found for this template");
            return;
        }

        const event = events.values().next().value as NostrEvent;

        return event.content;
    }
}

class HyperNoteQueryElement extends HTMLElement {
    // LOGGING
    // @ts-expect-error
    log(...args) {
        console.log(this.nodeName, `hn-query:${this.getAttribute("hn-query")}`, "\t\t\t", ...args);
    }

    static observedAttributes = ["kind", "authors", "limit"];

    constructor() {
        super();
    }

    async connectedCallback() {
        console.log("hn-query connectedCallback");
        await this.fetchQuery();
    }

    async fetchQuery() {
        const kind = this.getAttribute("kind");
        const authors = this.getAttribute("authors");
        const limit = this.getAttribute("limit");

        // Kind
        if (!kind || isNaN(Number(kind))) {
            console.error("Invalid kind provided");
            return;
        }

        let parsedKind = Number(kind);

        // Authors
        let authorsArray = [];

        if (authors?.startsWith("[") && authors?.endsWith("]")) {
            console.log("authors is an array");
            authorsArray = JSON.parse(authors);
        } else {
            authorsArray.push(authors);
        }

        // Convert all the authors into hexpubs
        authorsArray = authorsArray.map((a: string) => {
            return pubkeyToHexpub(a);
        });

        // Limit (defaults to 1)
        let parsedLimit = 1;

        if (limit && !isNaN(Number(limit))) {
            parsedLimit = Number(limit);
        }

        const query = {
            kinds: [parsedKind],
            authors: authorsArray,
            limit: parsedLimit,
        };

        let events = [];

        if (parsedLimit === 1) {
            const event = await ndk.fetchEvent({ kinds: query.kinds, authors: query.authors });
            events = [event];
        } else {
            const eventsSet = await ndk.fetchEvents(query);
            events = Array.from(eventsSet);
        }

        console.log(events);

        if (events.length === 0) {
            console.error("No events found for this query: ", query);
            return;
        }

        // See if we have an hn-element to hydrate
        const hnElement = this.querySelector("hn-element");

        if (hnElement) {
            for (const event of events) {
                // Create a clone of the hn-element
                const ele = hnElement.cloneNode(true) as HyperNoteElement;

                // Append the clone to the DOM first
                this.appendChild(ele);

                // Now the connectedCallback would have been fired

                // Set attribute and render
                const data = event.rawEvent();
                console.log("hydrating hn-element with data", data);
                ele.setAttribute("hn-event-data", JSON.stringify(data));
                ele.render();
            }
            // for (const _ of events) {
            //     // create a clone of the hn-element
            //     const ele = hnElement.cloneNode(true) as HyperNoteElement;
            //     this.appendChild(ele);
            // }

            // // Find all the hn-elements
            // const hnElements = this.querySelectorAll("hn-element");
            // for (const hnElement of hnElements) {
            //     const ele = hnElement as HyperNoteElement;
            //     console.log("hydrating hn-element", ele);
            //     const data = events.values().next().value.rawEvent();
            //     console.log("hydrating hn-element with data", data);
            //     ele.setAttribute("hn-event-data", JSON.stringify(data));
            //     ele.render();
            // }
        } else {
            // For each event put it in the dom inside a <pre> tag
            events.forEach((event) => {
                const pre = document.createElement("pre");

                // Add a style to the pre tag so it wraps
                pre.style.whiteSpace = "pre-wrap";
                pre.style.wordBreak = "break-word";

                pre.innerText = JSON.stringify(event?.rawEvent(), null, 2);
                this.appendChild(pre);
            });
        }


    }

}

// First we register the hn-elements
// Then we register the hn-query parent elements that will hydrate those elements
customElements.define("hn-query", HyperNoteQueryElement)
customElements.define("hn-element", HyperNoteElement);

// 
// 
// Utility functions
// 
// 
function fromHTML(html: string) {
    // Process the HTML string.
    html = html.trim();
    if (!html) return null;

    // Then set up a new template element.
    const template = document.createElement('template');
    template.innerHTML = html;
    const result = template.content.firstChild;

    return result as HTMLTemplateElement;
}

function parseTemplateString(templateId: string | undefined | null): [string, string] {
    // If there's no template, we can't do anything
    if (!templateId) {
        console.error("No template provided for hn-element");
        return ["", ""];
    }

    // Parse the template string. It should be formatted as:
    // `nostr:${npub}/${templateName}`
    const [n, templateString] = templateId.split(":");
    if (n !== "nostr") {
        console.error("Invalid template string. Should start with nostr:");
    }

    const [npub, templateName] = templateString.split("/");
    return [npub, templateName];
}

function processContent(content?: string) {
    if (!content) {
        return content;
    }
    try {
        return JSON.parse(content);
    } catch (e) {
        return content;
    }
}


function pubkeyToHexpub(pubkey: string): string {
    // Only decode if it's prefixed
    for (const prefix of prefixes) {
        if (pubkey.startsWith(prefix)) {
            const decoded = nip19.decode(pubkey).data.toString();
            return decoded;
        }
    }
    return pubkey
}

const query = await ndk.fetchEvents({
    kinds: [0],
    authors: ["0d6c8388dcb049b8dd4fc8d3d8c3bb93de3da90ba828e4f09c8ad0f346488a33"],
});

console.log("query test", query);
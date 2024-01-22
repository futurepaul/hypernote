### Hypernote

Hypernote is a "hypermedia system" built on top of nostr. It borrows ideas liberally from htmx. This proof-of-concept implementation is built with standard web technologies like web components, js, css, and html.

A "hypermedia system" is basically a document ("media") with a way to navigate to and refer to other documents ("hyper" / "hyperlinks" / "hypermedia references"). The original web is a "hypertext", with `.html` documents that link to one another. Additionally, the early web had forms, which were a way to `POST` data to an endpoint and receive back a brand new `.html` page.

A lot can be built with just these primitives! As the more modern web has shown, and htmx has so brilliantly condensed, much of the rest of the value we perceieve as "the web" is the ability to `POST` data to an endpoint and replace just one portion of the page with the response.

For instance, early Google was a simple hypermedia system where you would submit a search form and get a new `.html` full of hyperlinks to search results. The more modern version of Google starts searching as you type, replacing just a portion of the page with live search results / suggestions. Modern JavaScript frameworks are typically required for such functionality, and recently htmx has shown how it's possible to build with minimal extensions to html's original hypermedia concepts.

So, what does this have to do with nostr?

Nostr has many of the elements of a hypermedia system. You can "get" an event if you know its ID. You can "post" a new note. Events often have "references" to one another. Where nostr differs from hypermedia is that the "media" part is left as an exercise to the client.

On the web we have "hypermedia clients" called "browsers." Browsers send and request JSON all the time, but what they primarily **display** is actual hypermedia in the form of html.

On nostr, client applications translate the nostr-native JSON of various event kinds into whatever form they prefer: on the web, html, on mobile various other representations. Naturally, (lol what was I going to say here)

A "nostr browser" application wouldn't quite make sense, because there's no native media representation of nostr events.

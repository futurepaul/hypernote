### Welcome to Hypernote

WARNING: Hypernote is not finished, not a published spec, and everything can and will be broken. So don't publish your life's work on it yet. And be careful what you sign! You never know what html is lurking.

Right now you can only do one thing with hypernote. [Build your own guestbook](https://www.hypernote.club/create.html)

To see an example guestbook, [check out mine](https://www.hypernote.club/hn/npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/my-guestbook).

### The technical explainer

When you publish a guestbook it creates a kind 32616 event with a "d" tag of the slug ("my-guestbook" in this case). And the content is this:

```html
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
			<input type="hidden" name="p" value="${authorHexpub}" />
			<input
				type="hidden"
				name="a"
				value='["30023:${authorHexpub}:${pageSlug}","","root"]'
			/>
			<button type="submit">Sign The Guestbook</button>
		</hn-form>
		<hn-query kind="1" a="30023:${authorHexpub}:${pageSlug}" limit="10">
			<hn-element
				hn-template="nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/note-basic"
			></hn-element>
		</hn-query>
	</main>
</template>
```

That gets rendered by the `/hn/${npub}/${d}` route like this:

```html
<hn-query authors="${params.npub}" d="${params.d}" kind="30023">
	<hn-element
		hn-template="nostr:${params.npub}/${params.d}"
	></hn-element> </hn-query
>`;
```

I'll document this stuff eventually, but you can kind of see what's going on. You always start with a `hn-query` that returns some nostr events, and then passes that data to its child `hn-element` templates. Those templates can be references to other hypernotes (the ones with the `hn-template` tag) or inline templates (just an id, like the `summary-stuff` one in the guestbook example).

I don't know if the strong pairing of the kind 30023 and the hypernote "page" is the right move in the long term but it was the simplest way I could think of for now.

### Hypernote The Long Version

Hypernote is a "hypermedia system" built on top of nostr. It borrows ideas liberally from htmx. This proof-of-concept implementation is built with standard web technologies like web components, js, css, and html.

A "hypermedia system" is basically a document ("media") with a way to navigate to and refer to other documents ("hyper" / "hyperlinks" / "hypermedia references"). The original web is a "hypertext", with `.html` documents that link to one another. Additionally, the early web had forms, which were a way to `POST` data to an endpoint and receive back a brand new `.html` page.

A lot can be built with just these primitives! As the more modern web has shown, and htmx has so brilliantly condensed, much of the rest of the value we perceieve as "the web" is the ability to `POST` data to an endpoint and replace just one portion of the page with the response.

For instance, early Google was a simple hypermedia system where you would submit a search form and get a new `.html` full of hyperlinks to search results. The more modern version of Google starts searching as you type, replacing just a portion of the page with live search results / suggestions. Modern JavaScript frameworks are typically required for such functionality, and recently htmx has shown how it's possible to build with minimal extensions to html's original hypermedia concepts.

So, what does this have to do with nostr?

Nostr has many of the elements of a hypermedia system. You can "get" an event if you know its ID. You can "post" a new note. Events often have "references" to one another. Where nostr differs from hypermedia is that the "media" part is left as an exercise to the client.

On the web we have "hypermedia clients" called "browsers." Browsers send and request JSON all the time, but what they primarily **display** is actual hypermedia in the form of html.

On nostr, client applications translate the nostr-native JSON of various event kinds into whatever form they prefer: on the web, html, on mobile various other representations. Naturally, (lol what was I going to say here)

A "nostr browser" application wouldn't quite make sense, because there's no native media representation of nostr events.

(resuming writing this readme a month later..)

So that's why I made Hypernote. A "hypernote" is a nostr event combined a hypermedia representation of that event. This hypermedia cyborg is then published to nostr, naturally.

### What's the point?

The point is that nostr provides an easy way to publish your own "websites", a nice way to find them, and a great way to populate them with data (notes, longforms, profiles) and interactivity (forms that create more events, like notes on a guestbook page for instance).

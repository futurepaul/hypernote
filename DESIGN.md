# HyperNote Concepts

### Templates

creating a basic template element (note the hyphenated name for the template. single word elements are reserved for basic html I think). published as a kind 32616 event with a "d" tag of `"my-template"`

```html
<template id="my-template">
	<pre>hello world</pre>
</template>
```

using a basic template

```html
<hn-element hn-template="nostr:npub123abc/my-template"></hn-template>
```

will show up on the page as

```html
<my-template>
	<pre>hello world</pre>
</my-template>
```

a template that displays a kind 0 profile

```html
<template id="profile-basic" hn-kind="0">
	<style>
		img {
			width: 8rem;
			height: 8rem;
			object-fit: cover;
		}
	</style>
	<div>
		<pre>Pubkey:<slot name="pubkey"></slot></pre>
		<h2><slot name="content.name">No Name</slot></h2>
		<hn-img value="content.picture"></hn-img>
	</div>
</template>
```

a template that displays a kind 1 note

```html
<template id="note-basic">
	<style>
		#note {
			padding: 0.5rem;
			background: rgba(0, 0, 0, 0.05);
		}
		p {
			word-break: break-word;
		}
		.mono {
			font-family: monospace;
		}
	</style>
	<div id="note">
		<p><slot name="content">Note content goes here</span></p>
		<p class="mono"><strong>ID:</strong><hn-a value="id"></hn-a></p>
		<p class="mono"><strong>DATE:</strong><hn-time value="created_at"></hn-time></p>
	</div>
</template>
```

using the profile template

```html
<hn-element hn-template="nostr:npub123abc/profile-basic" hn-event="nostr:event123abc"></hn-template>
```

### Queries

a simple query for a profile. first result will be rendered with the `profile-basic` template. `authors` can either be an array or a single item.

```html
<hn-query
	kind="0"
	authors="npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8"
>
	<hn-element hn-template="nostr:npub123abc/profile-basic" />
</hn-query>
```

a query for multiple notes (implied by the limit, which defaults to 1). each note will be rendered with the `note-basic` template

```html
<hn-query
	limit="10"
	kind="1"
	authors='["npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8", "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft"]'
>
	<hn-element hn-template="nostr:npub123abc/note-basic" />
</hn-query>
```

a query with no `hn-element` child will print out as json

```html
<hn-query
	kinds="32616"
	authors="npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8"
></hn-query>
```

### Links

basic links (replaces body)

```html
<a href="nostr:npub123abc/slide1">link to a replaceable event</a>

or

<a href="nostr:eventid123">link to event</a>
```

targeted links (replaces target element)

```html
<a href="nostr:npub123abc/slide2" hn-target="#slide1">link</a>
```

use template for displaying returned event

```html
<a
	href="nostr:event123abc"
	hn-target="#slide1"
	hn-template="nostr:npub123abc/note-slide-template"
></a>
```

### Forms

regular text note

```html
<form hn-kind="1">
	<input name="content" type="text" />
	<button>Submit</button>
</form>
```

text note that replies to an event

```html
<form hn-kind="1">
	<input name="content" type="text" />
	<button>Submit</button>
	<input type="hidden" name="e" value="event1234" />
</form>
```

hypernote named event

```html
<form hn-kind="32616">
	<input name="d" type="text" placeholder="template name" />
	<input name="content" type="text" placeholder="<pre>hello world</pre>" />
	<button>Submit</button>
</form>
```

### Special Components

display nip-23 markdown content

```html
<template id="markdown-basic">
	<h1><slot name="title"></h1>
	<hn-img value="image"></hn-img>
	<hn-markdown value="content">
	</hn-markdown>
</template>
```

```html
<hn-query
	limit="10"
    kind="23"
    authors="npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8"
>
	<h1><slot name="title"></h1>
	<hn-markdown value="content">
	</hn-markdown>
</hn-query>
```

pretty print unix time

```html
<hn-time value="created_at"></hn-time>
```

link to njump

```html
<hn-a value="id"></hn-a>
```

display an image

```html
<hn-img value="content.picture"></hn-img>
```

### Slide deck (putting it all together)

```html
<template id="sec-demo-slide-1">
	<h1>this is slide 1</h1>
	<p>
		<a
			href="nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/sec-demo-slide-2"
		>
			this is a link to slide 2
		</a>
	</p>
</template>
```

```html
<template id="sec-demo-slide-2">
	<h1>this is slide 2</h1>
	<p>
		<a
			href="nostr:npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/sec-demo-slide-1"
		>
			this is a link to slide 1
		</a>
	</p>
</template>
```

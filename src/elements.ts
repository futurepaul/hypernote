export const profileSnippet = /*html*/ `
<header
	hn-kind="0"
	hn-author="npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8"
>
	<pre>ID:<span hn-field="id"></span></pre>
	<pre>Pubkey:<span hn-field="pubkey"></span></pre>
	<!-- No way to get a pretty date without JS? -->
	<pre>Created at:<time hn-field="created_at"></time></pre>
	<h2 hn-field="content.name">No Name</h2>
	<p>About: <span hn-field="content.about"></span></p>
	<img hn-src="content.picture" />
	<pre>Sig:<span hn-field="sig"></span></pre>
</header>
`;

export const noteSnippet = /*html*/ `
<section
hn-kind="1"
hn-author="npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8"
hn-limit="10"
>
<pre>ID:<span hn-field="id"></span></pre>
<pre>Created at:<time hn-field="created_at" hn-dvm="to-iso-time"></time></pre>
<p>Content: <span hn-field="content"></span></p>
</section>
`;

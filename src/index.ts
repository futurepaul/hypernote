type Route = {
	path: string;
	getTemplate?: (params?: { npub: string; d: string }) => string;
};

type CardProps = {
	href?: string;
	title: string;
	description: string;
	tags: string[];
	isComingSoon?: boolean;
	image: string;
};

const card = ({
	href,
	title,
	description,
	tags,
	isComingSoon,
	image,
}: CardProps) => {
	const wrapperTag = href ? "a" : "div";
	const hrefAttr = href ? `href="${href}"` : "";
	const className = `card${isComingSoon ? " coming-soon" : ""}`;
	const style = `style="background-image: url('${image}')"`;

	return `
		<${wrapperTag} ${hrefAttr} class="${className}">
			<div class="card-image" ${style}>
				<div class="card-tags">
					${tags.map((tag) => `<span class="kind-tag">${tag}</span>`).join("\n")}
				</div>
			</div>
			<h2 class="card-title">${title}</h2>
			<p class="card-description">${description}</p>
		</${wrapperTag}>
	`;
};

const routes: Route[] = [
	{
		path: "/",
		getTemplate: () => `
			<div class="home">
				<h1>HyperNote</h1>
				<p class="subtitle">A hypermedia system<br>built on nostr</p>
				<p>Hypernote is a <a href="https://hypermedia.systems/hypermedia-a-reintroduction/">hypermedia</a> experiment built on nostr and web technologies. It renders html saved as nostr events. And anyone can publish a nostr event. So, you know, be careful.<p>
				<div class="grid">
					${card({
						href: "/sec-demo1.html",
						title: "SEC-01 PRESENTATION",
						description:
							"The original introduction to HyperNote. Published as a HyperNote, naturally.",
						tags: ["KIND 30023", "KIND 32616"],
						image: "/hypercard-box.jpg",
					})}
					${card({
						href: "/hn/npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/my-guestbook",
						title: "GUESTBOOK",
						description:
							"HyperNote's killer app: reinvent the GeoCities guestbook.",
						tags: [
							"KIND 30023",
							"KIND 32616",
							"HN-FORM",
							"HN-QUERY",
						],
						image: "/guestbook-preview.png",
					})}
					${card({
						href: "/hn/npub1p4kg8zxukpym3h20erfa3samj00rm2gt4q5wfuyu3tg0x3jg3gesvncxf8/chess-dvm",
						title: "CHESS DVM",
						description:
							"Talk to a chess move DVM using HyperNote.",
						tags: ["HN-FORM", "KIND 5600"],
						image: "/chess-preview.png",
					})}
					${card({
						title: "HYPERNOTE STORIES",
						description:
							"It's like Instagram Stories, but with HyperNote!",
						tags: ["KIND 32616"],
						isComingSoon: true,
						image: "",
					})}
				</div>
			</div>`,
	},
	{
		path: "/hn/:npub/:d",
		getTemplate: (params) => {
			if (!params || !params.npub || !params.d) {
				return `<h1>Sorry, that doesn't look like a valid HyperNote address</h1>`;
			}

			return `
			<hn-query authors="${params.npub}" d="${params.d}" kind="30023">
				<hn-element
					hn-template="nostr:${params.npub}/${params.d}"
				></hn-element>
			</hn-query>`;
		},
	},
];

class Router {
	routes: Route[];

	constructor(routes: Route[]) {
		this.routes = routes;
		this._loadInitialRoute();
	}

	loadRoute(...urlSegments: string[]) {
		// Attempt to match the URL to a route.
		const matchedRoute = this._matchUrlToRoute(urlSegments);

		// Push a history entry with the new URL.
		// We pass an empty object and an empty string as the historyState
		// and title arguments, but their values do not really matter here.
		const url = `/${urlSegments.join("/")}`;
		history.pushState({}, "", url);

		console.log(history.state, url, urlSegments, matchedRoute);

		// Append the template of the matched route to the DOM,
		// inside the element with attribute data-router-outlet.
		const routerOutletElement = document.querySelectorAll(
			"[data-router-outlet]"
		)[0];

		if (matchedRoute && matchedRoute.getTemplate) {
			routerOutletElement.innerHTML = matchedRoute.getTemplate(
				// @ts-expect-error
				matchedRoute.params
			);
		}
	}

	_matchUrlToRoute(urlSegments: string[]) {
		const routeParams = {};

		// Try and match the URL to a route.
		const matchedRoute = this.routes.find((route) => {
			// We assume that the route path always starts with a slash, and so
			// the first item in the segments array  will always be an empty
			// string. Slice the array at index 1 to ignore this empty string.
			const routePathSegments = route.path.split("/").slice(1);

			// If there are different numbers of segments, then the route
			// does not match the URL.
			if (routePathSegments.length !== urlSegments.length) {
				return false;
			}

			// If each segment in the url matches the corresponding segment in the route path,
			// or the route path segment starts with a ':' then the route is matched.
			const match = routePathSegments.every((routePathSegment, i) => {
				return (
					routePathSegment === urlSegments[i] ||
					routePathSegment[0] === ":"
				);
			});

			// If the route matches the URL, pull out any params from the URL.
			if (match) {
				routePathSegments.forEach((segment: string, i: number) => {
					if (segment[0] === ":") {
						const propName = segment.slice(1);
						// @ts-expect-error
						routeParams[propName] = decodeURIComponent(
							urlSegments[i]
						);
					}
				});
			}
			return match;
		});
		return { ...matchedRoute, params: routeParams };
	}

	_loadInitialRoute() {
		// Figure out the path segments for the route which should load initially.
		const pathnameSplit = window.location.pathname.split("/");
		const pathSegments =
			pathnameSplit.length > 1 ? pathnameSplit.slice(1) : "";

		// Load the initial route.
		this.loadRoute(...pathSegments);
	}
}

const router = new Router(routes);

// Update header height on load and resize
function updateHeaderHeight() {
	const header = document.getElementById('hypernote-header');
	if (header) {
		const height = header.offsetHeight;
		document.documentElement.style.setProperty('--header-height', `${height}px`);
	}
}

// Initial calculation
updateHeaderHeight();

// Update on window resize
window.addEventListener('resize', updateHeaderHeight);

// Update when content changes (for dynamic content)
const resizeObserver = new ResizeObserver(updateHeaderHeight);
const header = document.getElementById('hypernote-header');
if (header) {
	resizeObserver.observe(header);
}

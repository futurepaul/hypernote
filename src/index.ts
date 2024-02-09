type Route = {
	path: string;
	getTemplate?: (params?: { npub: string; d: string }) => string;
};

const routes: Route[] = [
	{
		path: "/",
		getTemplate: () => `<h1>HyperNote</h1>
		<ul>
			<li>
				<a href="/sec-demo1.html">Sec Presentation</a>
			</li>
			<li>
				<a href="/design.html">Design Demo</a>
			</li>
			<li>
				<a href="/publish.html">Publish</a>
			</li>
			<li>
				<a href="/guestbook.html">Guestbook</a>
			</li>
			<li>
				<a href="/dvm.html">DVM</a>
			</li>
		</ul>`,
	},
	{
		path: "/hn/:npub/:d",
		getTemplate: (params) => {
			if (!params || !params.npub || !params.d) {
				return `<h1>Sorry, that doesn't look like a valid HyperNote address</h1>`;
			}

			return `
			<hn-query authors="${params.npub}" d="home" kind="30023">
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
				routePathSegments.forEach((segment, i) => {
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

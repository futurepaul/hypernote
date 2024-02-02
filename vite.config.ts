import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		target: "esnext",
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				guestbook: resolve(__dirname, "guestbook.html"),
				dvm: resolve(__dirname, "dvm.html"),
				publish: resolve(__dirname, "publish.html"),
				"sec-demo1": resolve(__dirname, "sec-demo1.html"),
			},
		},
	},
});

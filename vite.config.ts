import { resolve } from "node:path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig({
	plugins: [checker({ typescript: false })],
	build: {
		target: "esnext",
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				design: resolve(__dirname, "design.html"),
				guestbook: resolve(__dirname, "guestbook.html"),
				dvm: resolve(__dirname, "dvm.html"),
				publish: resolve(__dirname, "publish.html"),
				"sec-demo1": resolve(__dirname, "sec-demo1.html"),
				create: resolve(__dirname, "create.html"),
				about: resolve(__dirname, "about.html"),
			},
		},
	},
});

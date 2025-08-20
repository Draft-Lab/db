import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	format: ["esm"],
	target: "esnext",
	dts: true,
	clean: true,
	unbundle: true
})

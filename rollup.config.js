import deckyPlugin from "@decky/rollup";

const config = deckyPlugin({
  // Add your extra Rollup options here
});

// @decky/rollup 1.0.1 defaults output.format to "esm", which ends the
// bundle with `export { index as default };`. Some Decky Loader builds
// (notably older SteamOS releases) serve the bundle as a regular script
// rather than an ES module, which produces "SyntaxError: unexpected
// token 'export'" on load. Override to IIFE so the bundle is a
// self-contained script that works regardless of how the loader serves it.
// The IIFE wrapper assigns the plugin to a `deckyPlugin` global that the
// loader reads after executing the script.
config.output.format = "iife";
config.output.name = "deckyPlugin";

export default config;

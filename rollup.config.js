import deckyPlugin from "@decky/rollup";

const config = deckyPlugin({
  // Add your extra Rollup options here
});

// @decky/rollup 1.0.1 defaults output.format to "esm", which ends the
// bundle with `export { index as default };`. The Decky Loader (per its
// Python plugin-wrapper) picks the load path based on package.json's
// "type" field:
//   - "type": "module"            -> ESMODULE_V1  (uses import() + .default())
//   - any other / absent          -> LEGACY_EVAL_IIFE  (fetches and evals,
//     capturing the expression value as the plugin)
//
// We intentionally omit "type": "module" from package.json and override
// the output format to IIFE here, so the loader takes the LEGACY_EVAL_IIFE
// path and our IIFE bundle gets evaluated. Two further details matter:
//
//   1. We do NOT set output.name. With a name, rollup emits
//      `var deckyPlugin = (function() { ... })()`, which is a variable
//      declaration and evals to undefined — the loader would then call
//      `plugin_export(...)` and fail with "plugin_export is not a function".
//      Without a name, rollup emits a bare function-call expression
//      `(function() { ... return index; })()`, whose expression value is
//      the plugin factory. The eval captures it.
//
//   2. The IIFE takes `SP_REACT` (and other loader-provided globals like
//      `DFL`, `SP_REACTDOM`) as parameters via the externalGlobals plugin.
//      This matches the convention used by other working plugins such as
//      hulkrelax/hltb-for-deck.
config.output.format = "iife";

export default config;

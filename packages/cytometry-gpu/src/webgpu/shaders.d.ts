// Vite resolves `?raw` imports to the file's text. Declared here so the WebGPU
// modules type-check without the bundler present.
declare module "*.wgsl?raw" {
  const source: string;
  export default source;
}

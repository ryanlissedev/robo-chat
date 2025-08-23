// CSS loader for Vitest tests
export function load(url, context, defaultLoad) {
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      source: 'export default {};',
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
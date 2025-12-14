const globalRef = typeof window !== 'undefined' ? window : globalThis;
const ReactDOMRuntime =
  globalRef && (globalRef.ReactDOMClient || globalRef.ReactDOM) ? globalRef.ReactDOMClient || globalRef.ReactDOM : null;

if (!ReactDOMRuntime || typeof ReactDOMRuntime.createRoot !== 'function') {
  throw new Error(
    'ReactDOM client runtime not found. Ensure react-dom.production.min.js is loaded before jingle_bell_hero_app.js.',
  );
}

export default ReactDOMRuntime;

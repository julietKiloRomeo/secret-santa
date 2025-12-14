const globalRef = typeof window !== 'undefined' ? window : globalThis;
const ReactRuntime = globalRef && globalRef.React ? globalRef.React : null;

if (!ReactRuntime) {
  throw new Error(
    'React runtime not found. Ensure react.production.min.js is loaded before jingle_bell_hero_app.js.',
  );
}

export default ReactRuntime;

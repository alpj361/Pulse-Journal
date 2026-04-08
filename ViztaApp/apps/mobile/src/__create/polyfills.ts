// Create.xyz fetch wrapper disabled in release builds.
// The wrapper added x-createxyz-* headers with placeholder values and
// redirected relative URLs to http://localhost:4001 (which doesn't exist
// in production). The app uses Supabase auth and absolute API URLs directly,
// so this wrapper is only kept alive in dev for scaffold compatibility.
if (__DEV__) {
  const updatedFetch = require('./fetch').default;
  // @ts-ignore
  global.fetch = updatedFetch;
}

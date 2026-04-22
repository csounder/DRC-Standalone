// Vite supports importing any asset as a raw string via the `?raw` suffix.
// The main process bundle runs through electron-vite (Vite under the hood),
// so these imports work in dev and production builds.
declare module '*.txt?raw' {
  const content: string
  export default content
}

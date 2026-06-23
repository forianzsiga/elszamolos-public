export default async (_ctx) => {
  return {
    event: async (input) => {
      const ev = input?.event || input;
      // Whenever the file watcher registers a config/agent change,
      // trigger the programmatic in-memory hot-reload endpoint.
      if (ev && ev.type === "opencode.hotreload.changed") {
        const client = _ctx?.client;
        if (client && client.hotreload && typeof client.hotreload.apply === "function") {
          await client.hotreload.apply({
            file: ev.properties?.file || "api",
            event: ev.properties?.event || "change"
          }).catch(() => {});
        }
      }
    }
  };
};

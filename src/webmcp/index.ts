import { buildTools, readChannels } from './tools';
import { stir } from '../contact/seance';

// Hand the grimoire's tools to the browser's agent (WebMCP). All or none: if
// the browser refuses one, the others are withdrawn with it.
export async function initWebMCP(): Promise<void> {
  const mc = document.modelContext ?? navigator.modelContext;
  if (typeof mc?.registerTool !== 'function') return;
  const controller = new AbortController();
  try {
    await Promise.all(buildTools(readChannels(), stir)
      .map(tool => mc.registerTool(tool, { signal: controller.signal })));
  } catch (e) {
    controller.abort();
    console.warn('[webmcp] tools withdrawn:', e);
  }
}

/**
 * store/singleton.ts - the single per-page store instance.
 */
import { PanelStore } from "./panel.ts"

export const panel = new PanelStore()

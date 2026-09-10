export { planConsole, homeApps, configApps, parseConsoleHash, type ConsoleCatalogue, type ConsoleEntry, type HomeApp } from "./console-plan.ts"
import { runConsole } from "./console-runtime.ts"
export type OpenPanel = (panel: HTMLElement, id: string, current: () => boolean) => Promise<void>
export const bootConsole = (config: OpenPanel, view: OpenPanel) => runConsole(config, view)

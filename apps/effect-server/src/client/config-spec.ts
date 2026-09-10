export type ConfigElementSpec = { type: string; props?: Record<string, unknown>; children?: string[] }
export type ConfigSpec = { root: string; elements: Record<string, ConfigElementSpec> }
export type ConfigMount = { read: () => Record<string, unknown>; dispose: () => void }
export type ConfigMountFactory = (container: HTMLElement, spec: unknown) => ConfigMount
export const supportsConfigSpec = (input: unknown): input is ConfigSpec => {
  const spec = input as Partial<ConfigSpec>
  if (!spec || typeof spec !== "object" || !spec.elements) return false
  return Object.values(spec.elements).every(({ props }) => props?.role !== "array" || typeof props.itemSchema === "object")
}

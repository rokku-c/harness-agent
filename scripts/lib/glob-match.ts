export const matches = (pattern: string, value: string): boolean => {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const segment = (part: string): string => part.split("*").map(escape).join("[^/]*")
  const rx = new RegExp("^" + pattern.split("**").map(segment).join(".*") + "$")
  return rx.test(value)
}

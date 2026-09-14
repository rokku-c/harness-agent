export const short = (value: unknown, max = 160): string => {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value)
    return text.length > max ? text.slice(0, max) + "… (+truncated " + (text.length - max) + " chars)" : text
  } catch {
    return "(unserializable)"
  }
}

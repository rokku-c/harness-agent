export const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "_")

export const makeServedNames = (what: string): ((owner: string, name: string) => string) => {
  const held = new Map<string, string>()
  return (owner, name) => {
    const served = sanitize(name)
    const other = held.get(served)
    if (other !== undefined) {
      throw new Error(`${what} "${other}" and "${owner}" both serve as "${served}"; rename one of them`)
    }
    held.set(served, owner)
    return served
  }
}

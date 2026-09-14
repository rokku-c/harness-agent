import * as React from "react"
import { parseDestination, type ConsoleDestination } from "./console-route.ts"

export const useAddress = (): string => {
  const [hash, setHash] = React.useState(() => window.location.hash)
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}

export const useDestination = (): ConsoleDestination => {
  const hash = useAddress()
  return React.useMemo(() => parseDestination(hash), [hash])
}

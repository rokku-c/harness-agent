import * as React from "react"

const READ_NOW = "effect-console-read-now"

export const readNow = (): void => { window.dispatchEvent(new CustomEvent(READ_NOW)) }

export const useReadNow = (): number => {
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    const onRead = (): void => setCount((value) => value + 1)
    window.addEventListener(READ_NOW, onRead)
    return () => window.removeEventListener(READ_NOW, onRead)
  }, [])
  return count
}

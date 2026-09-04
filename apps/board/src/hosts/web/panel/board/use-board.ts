/** panel/board/use-board.ts - the BOARD DATA HOOK.
 *  Concept: one pull fetches state + column view + new events since the
 *  cursor in parallel; newest events prepend (ring capped at 150); the
 *  poll timer runs every 1500ms until unmount. No event-stream subscribe. */
import { useEffect, useRef, useState } from "react"
import { api, type ColInfo, type Snapshot } from "../api.ts"

export interface Ev { ts: number; type: string; message?: string }

export const useBoard = (): {
  snap: Snapshot
  cols: ColInfo[]
  evs: Ev[]
  lastSync: number
  refresh: () => Promise<void>
} => {
  const [snap, setSnap] = useState<Snapshot>({ items: [], resources: [], executors: [] })
  const [cols, setCols] = useState<ColInfo[]>([])
  const [evs, setEvs] = useState<Ev[]>([])
  const [lastSync, setLastSync] = useState<number>(0)
  const aliveRef = useRef(true)
  const cursorRef = useRef(0)

  const pull = async (): Promise<void> => {
    const [s, v, fresh] = await Promise.all([api.state(), api.view(), api.events(cursorRef.current)])
    if (!aliveRef.current) return
    setSnap(s)
    setCols(v)
    const newest = fresh.filter((e) => e.ts > cursorRef.current)
    if (newest.length > 0) {
      cursorRef.current = Math.max(...newest.map((e) => e.ts))
      setEvs((prev) => [...newest.reverse(), ...prev].slice(0, 150))
    }
    setLastSync(Date.now())
  }

  useEffect(() => {
    aliveRef.current = true
    void pull().catch(() => undefined)
    const t = setInterval(() => pull().catch(() => undefined), 1500)
    return () => { aliveRef.current = false; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { snap, cols, evs, lastSync, refresh: pull }
}

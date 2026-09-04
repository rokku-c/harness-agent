/** board panel browser entry (built by `bun run build:web` in apps/board) */
import { MantineProvider } from "@mantine/core"
import "@mantine/core/styles.css"
import { createRoot } from "react-dom/client"
import { boardTheme } from "./theme.ts"
import { BoardApp } from "./BoardApp.tsx"

const host = document.getElementById("root")
if (host === null) throw new Error("#root missing")
createRoot(host).render(
  <MantineProvider theme={boardTheme} defaultColorScheme="light">
    <BoardApp />
  </MantineProvider>
)

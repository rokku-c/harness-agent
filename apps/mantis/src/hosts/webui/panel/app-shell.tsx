/** mantis console - browser entry (built by build:web; served by the HTTP shell) */
// simple-line minimal light (line-minimal direction)
import { MantineProvider } from "@mantine/core"
import "@mantine/core/styles.css"
import { createRoot } from "react-dom/client"
import { consoleTheme } from "./theme.ts"
import { App } from "./App.tsx"

const root = document.getElementById("root")
if (root === null) throw new Error("#root missing")
createRoot(root).render(
  <MantineProvider theme={consoleTheme} forceColorScheme="light">
    <App />
  </MantineProvider>
)

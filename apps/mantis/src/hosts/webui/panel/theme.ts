import { createTheme } from "@mantine/core"

/** mantis console - simple-line minimal (light) edition: hairline borders,
 *  near-white surfaces, one blue accent, dense calm type. No decorative
 *  skin; structure carries the interface (user direction: 线条极简). */
export const consoleTheme = createTheme({
  primaryColor: "brand",
  colors: {
    brand: [
      "#e6effc", "#d3e2f8", "#abc8ef", "#7eabe4", "#4e8ad9", "#3f78c8",
      "#3263a8", "#285087", "#1e3d66", "#142b48"
    ]
  },
  fontFamily: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  fontSizes: { xs: "11px", sm: "12px", md: "13px", lg: "14px", xl: "16px" },
  lineHeights: { xs: "1.4", sm: "1.45", md: "1.45", lg: "1.5", xl: "1.5" },
  headings: { fontWeight: "650" },
  radius: { xs: "2px", sm: "3px", md: "5px", lg: "8px", xl: "12px" },
  spacing: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  defaultRadius: "sm",
  primaryShade: 6,
  components: {
    Button: { defaultProps: { size: "compact-sm" } },
    Badge: { defaultProps: { variant: "outline" } },
    TextInput: { defaultProps: { size: "xs" } },
    Paper: { defaultProps: { radius: "sm" } }
  }
})

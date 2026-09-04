import { createTheme } from "@mantine/core"

/** mantis console - restrained professional dark theme: dense, calm,
 *  blue accent, information first (product canvas v1: no decorative skin). */
export const consoleTheme = createTheme({
  primaryColor: "brand",
  colors: {
    brand: [
      "#e6effc", "#cfe0f8", "#a3c4f0", "#74a6e6", "#4e8ad9", "#3f78c8",
      "#3263a8", "#285087", "#1e3d66", "#142b48"
    ]
  },
  fontFamily: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  fontSizes: { xs: "11px", sm: "12px", md: "13px", lg: "14px", xl: "16px" },
  lineHeights: { xs: "1.4", sm: "1.45", md: "1.45", lg: "1.5", xl: "1.5" },
  headings: { fontWeight: "600" },
  radius: { xs: "3px", sm: "5px", md: "8px", lg: "12px", xl: "16px" },
  spacing: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  defaultRadius: "md",
  primaryShade: 6,
  components: {
    Button: { defaultProps: { size: "compact-sm" } },
    Badge: { defaultProps: { variant: "light" } },
    TextInput: { defaultProps: { size: "xs" } }
  }
})

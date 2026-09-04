/** board panel theme - light, clean, thin dividers (Mantine) */
import { createTheme } from "@mantine/core"

export const boardTheme = createTheme({
  primaryColor: "brand",
  colors: {
    brand: [
      "#eef4ff", "#dbe7ff", "#b7ccff", "#8fabff", "#6b8df2", "#4f7ae8",
      "#3f64d0", "#3450ab", "#2b4189", "#24376f"
    ]
  },
  fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
  fontFamilyMonospace: "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace",
  fontSizes: { xs: "11px", sm: "12px", md: "13px", lg: "14px", xl: "16px" },
  lineHeights: { xs: "1.45", sm: "1.5", md: "1.55", lg: "1.55", xl: "1.6" },
  headings: { fontWeight: "650" },
  radius: { xs: "3px", sm: "5px", md: "7px", lg: "9px", xl: "12px" },
  spacing: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  defaultRadius: "sm",
  primaryShade: 6,
  defaultGradient: { from: "#4f7ae8", to: "#3f64d0", deg: 90 },
  components: {
    Button: { defaultProps: { radius: "sm" } },
    Badge: { defaultProps: { radius: "sm" } },
    Paper: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "md" } }
  }
})

import { z } from "zod"

/** Shared json-render component schemas, resolved with effect-ui's Zod version. */
export const formComponents = {
  Stack: {
    props: z.object({
      direction: z.enum(["horizontal", "vertical"]).optional(),
      gap: z.number().optional(),
      role: z.string().optional(),
    }),
    description: "Flex container that adapts to available width",
  },
  Text: {
    props: z.object({ value: z.string().optional() }),
    description: "Static text",
  },
  Button: {
    props: z.object({ label: z.string().optional() }),
    description: "Button",
  },
  Input: {
    props: z.object({ label: z.string().optional(), value: z.string().optional(), placeholder: z.string().optional() }),
    description: "Text input",
  },
}

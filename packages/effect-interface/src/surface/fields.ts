/** Input shapes every surface asks for the same way. */
import { z } from "zod"

/**
 * An operation that takes no input at all. Strict on purpose: a caller sending a
 * field the operation never declared is told so, rather than having it dropped
 * and wondering why nothing happened.
 */
export const noInput = z.object({}).strict()

/**
 * A list that arrives comma-separated over HTTP - there is no array syntax in a
 * query string - and as a real array over MCP. One field, so both surfaces
 * accept the same thing.
 */
export const csv = <S extends z.ZodType>(list: S): S =>
  z.preprocess(
    (value) => typeof value === "string"
      ? value.split(",").map((entry) => entry.trim()).filter((entry) => entry !== "")
      : value,
    list,
  ) as unknown as S

/**
 * A number that arrives as text in a query string and as a number over MCP, so
 * one field serves both without the declaration caring which asked.
 */
export const count = z.coerce.number().int().min(0)

/**
 * A document that arrives as JSON text in a query string - there is no syntax
 * for an object there - and as the object itself over MCP. The same split `csv`
 * bridges, one level up: a machine saying what it is already running has to fit
 * in a URL, and the tool beside it does not. Text that is not JSON is left as it
 * arrived, so the shape refuses it rather than this reading it as something.
 */
export const json = <S extends z.ZodType>(shape: S): S =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      try { return JSON.parse(value) } catch { return value }
    },
    shape,
  ) as unknown as S

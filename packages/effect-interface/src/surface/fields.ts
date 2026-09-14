import { z } from "zod"

export const noInput = z.object({}).strict()

export const csv = <S extends z.ZodType>(list: S): S =>
  z.preprocess(
    (value) => typeof value === "string"
      ? value.split(",").map((entry) => entry.trim()).filter((entry) => entry !== "")
      : value,
    list,
  ) as unknown as S

export const count = z.coerce.number().int().min(0)

export const json = <S extends z.ZodType>(shape: S): S =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      try { return JSON.parse(value) } catch { return value }
    },
    shape,
  ) as unknown as S

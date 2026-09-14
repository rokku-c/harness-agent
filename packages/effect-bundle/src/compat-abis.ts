import type { AbiLine, Incompatibility } from "./compat-verdict.ts"

export const KERNEL_ABI = "effect-1"

export const BOOTSTRAP_ABI = "bootstrap-1"

const lineOf = (abi: string, prefix: string): string | undefined => {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(abi.trim())
  return match === null ? undefined : `${prefix}-${match[1]}`
}

export const abiLine = (abi: string): string | undefined => lineOf(abi, "effect")

export const assessAbiLine = (
  line: AbiLine,
  wantAbi: string,
  haveAbi: string,
  subject: string,
): Incompatibility | undefined => {
  const want = lineOf(wantAbi, line)
  const have = lineOf(haveAbi, line)
  if (want === undefined) {
    return {
      code: "abi-unparseable",
      line,
      required: wantAbi,
      provided: haveAbi,
      message: `unrecognized abi "${wantAbi}" on ${subject}; expected "${line}-<major>"`,
    }
  }
  if (have === undefined) {
    return {
      code: "abi-unparseable",
      line,
      required: wantAbi,
      provided: haveAbi,
      message: `host declares an unrecognized abi "${haveAbi}"; expected "${line}-<major>"`,
    }
  }
  if (want !== have) {
    return {
      code: "abi-mismatch",
      line,
      required: wantAbi,
      provided: haveAbi,
      message: `${subject} requires ${want} but the host implements ${have}`,
    }
  }
  return undefined
}

import { timingSafeEqual } from "node:crypto"
export interface RegistryAuth {
  /** Accept an owner token or registration token for a server. */
  authorize(token: string, serverId: string): boolean
}


export interface RegistryTokenSet {
  readonly ownerToken?: string
  readonly registrationToken?: string
}

type TokenConfig = string | RegistryTokenSet

const same = (left: string, right: string): boolean => {
  const a = Buffer.from(left), b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

const tokensOf = (config: TokenConfig): readonly string[] =>
  typeof config === "string" ? [config] : [config.ownerToken, config.registrationToken].filter((token): token is string => token !== undefined)

/** Build an auth policy without putting any credential into registry records. */
export const makeRegistryAuth = (configs: Readonly<Record<string, TokenConfig>>): RegistryAuth => ({
  authorize: (token, serverId) => tokensOf(configs[serverId] ?? {}).some((expected) => same(expected, token)),
})

import type { PrincipalRegistry } from "./principals.ts"
import { makeStoredPrincipals } from "./principals-sqlite.ts"
import { openGatewayDatabase } from "./database.ts"
import type { TokenStore } from "./token.ts"
import { makeStoredTokens } from "./token-sqlite.ts"

export interface IdentityStore {
  readonly principals: PrincipalRegistry
  readonly tokens: TokenStore
  close(): void
}

export const makeIdentityStore = (file: string, now?: () => number): IdentityStore => {
  const database = openGatewayDatabase(file)
  let closed = false
  return {
    principals: makeStoredPrincipals(database, now),
    tokens: makeStoredTokens(database, now),
    close: () => { if (!closed) { closed = true; database.close() } },
  }
}

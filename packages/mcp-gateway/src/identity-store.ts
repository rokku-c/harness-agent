/**
 * mcp-gateway — the identities, on one file.
 *
 * A token's principal key is a foreign key into the directory beside it, so the
 * two are opened together and closed together: a store that could be closed
 * halfway would leave a token pointing at a directory nobody can read.
 *
 * This is the whole of what an app states: which file, and when to let go. The
 * file's shape, the two tables, and the two readers are the package's, so an app
 * that mounts a governed door contains no storage at all.
 */
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

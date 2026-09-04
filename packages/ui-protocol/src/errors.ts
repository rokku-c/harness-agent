export type UIErrorCode = "not-found" | "version-conflict" | "invalid-tree" | "unknown-component"
export class UIError extends Error {
  constructor(readonly code: UIErrorCode, message: string) { super(message) }
}

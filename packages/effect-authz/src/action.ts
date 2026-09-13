/**
 * effect-authz — the action vocabulary.
 *
 * One action triple (`read | call | write`) is the whole surface.
 *
 * The union is declared locally rather than imported: this package must stay
 * dependency-free, because its consumers depend on *it* and the arrow must not
 * point back. A consumer holding its own vocabulary states the mapping on its
 * own side.
 */

export type Action = "read" | "call" | "write"

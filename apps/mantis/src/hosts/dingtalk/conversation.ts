/**
 * Barrel: dingtalk conversation memory split by CONCEPT (see ./conversation/).
 * contract.ts = Turn + options; store.ts = durable per-conversation log;
 * binding.ts = transcript render + the read-only context binding.
 */
export type { Turn, ConversationStoreOptions } from "./conversation/contract.ts"
export { ConversationStore } from "./conversation/store.ts"

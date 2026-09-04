/**
 * Barrel: the mantis session agent split by CONCEPT (see ./agent/).
 * persona.ts = prompt material; options.ts = session options + result
 * contract; make.ts = the assembly (supply + driver + final_answer).
 */
export { MANTIS_INSTRUCTIONS, REFLECT_PROMPT } from "./agent/persona.ts"
export type { MantisOptions, Mantis } from "./agent/options.ts"
export { mantisSupply, makeMantis, runMantis } from "./agent/make.ts"

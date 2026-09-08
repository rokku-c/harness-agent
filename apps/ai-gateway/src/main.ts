import { startStandaloneAiGateway } from "./standalone.ts"

export { gatewayConfig, type AiGatewayConfig, type GatewayProvider, type ApiType } from "./config.ts"
export { startAiGateway, type AiGatewayServerOptions } from "./standalone.ts"
export { startStandaloneAiGateway, type StandaloneAiGatewayOptions } from "./standalone.ts"
export { typeOrmRecorder, type StoredGatewayRecorder } from "./recorder.ts"

if (import.meta.main) startStandaloneAiGateway({ file: process.env.EFFECT_CONFIG_FILE })

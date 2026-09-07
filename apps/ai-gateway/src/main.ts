import { gatewayConfig } from "./config.ts"
import { startAiGateway } from "./server.ts"

export { gatewayConfig } from "./config.ts"
export { startAiGateway, type AiGatewayServerOptions } from "./server.ts"

if (import.meta.main) startAiGateway(gatewayConfig())

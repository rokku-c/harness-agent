export class AgentdError extends Error { constructor(readonly status: number, message: string) { super(message); this.name = "AgentdError" } }

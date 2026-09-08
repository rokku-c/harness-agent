import type { EffectTool } from "@effect-agent/effect-interface"
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv"
import type { JsonSchemaType, JsonSchemaValidator } from "@modelcontextprotocol/sdk/validation"

const validators = new WeakMap<object, JsonSchemaValidator<unknown>>()

/** JSON-only MCP tools need the same pre-handler validation as zod-backed tools. */
export const validateAppArguments = (tool: EffectTool, args: unknown): void => {
  const schema = tool.inputSchema
  if (schema === undefined || schema === true) return
  const invalid = (detail: string): never => {
    throw new Error(`invalid arguments for ${tool.name}: ${detail}`)
  }
  if (schema === false) invalid("schema rejects all arguments")
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    invalid("invalid input schema")
  }
  const object = schema as object
  let validate = validators.get(object)
  if (validate === undefined) {
    // Isolate schemas: another app's identical $id must not select its validator.
    validate = new AjvJsonSchemaValidator().getValidator(schema as JsonSchemaType)
    validators.set(object, validate)
  }
  const result = validate(args)
  if (!result.valid) invalid(result.errorMessage)
}

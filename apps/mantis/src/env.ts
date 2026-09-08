/** Product env accessor. Use envVar("WEB_PORT") for MANTIS_WEB_PORT. */
export const envVar = (name: string): string | undefined =>
  process.env["MANTIS_" + name] ?? process.env["MANTIS_" + name]

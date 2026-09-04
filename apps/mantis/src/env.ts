/** Product env accessor: prefers the MANTIS_* prefix (product name) and
 * falls back to the legacy MANTIS_* prefix so existing shell/pm2 setups keep
 * working unmodified. Use envVar("WEB_PORT") for MANTIS_WEB_PORT/MANTIS_WEB_PORT. */
export const envVar = (name: string): string | undefined =>
  process.env["MANTIS_" + name] ?? process.env["MANTIS_" + name]

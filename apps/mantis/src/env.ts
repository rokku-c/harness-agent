export const envVar = (name: string): string | undefined => process.env["MANTIS_" + name]

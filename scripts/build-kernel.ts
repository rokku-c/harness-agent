import { compileKernelRevision, kernelBundleDir, KERNEL_MANIFEST } from "@effect-agent/effect-bundle"

const KERNEL_DIR = new URL("../apps/effect-server/src/kernel", import.meta.url).pathname
const outDir = process.argv[2] ?? ".effect-bundles"

const manifest = await compileKernelRevision({ kernelDir: KERNEL_DIR, outDir })
const dir = kernelBundleDir(outDir, manifest.bundleId)
console.log(`built ${manifest.bundleId} (effect ${manifest.abi}, needs ${manifest.bootstrapAbi})`)
console.log(`  artifact: ${dir}`)
console.log(`  manifest: ${dir}/${KERNEL_MANIFEST}`)

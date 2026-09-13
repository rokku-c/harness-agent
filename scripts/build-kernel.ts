/**
 * bun run kernel:build [outDir]
 *
 * Emits this repository's kernel as a **kernel artifact** — the same directory
 * shape `loadKernel` imports, and the same one a control plane can push to a
 * node. Before this, staging a kernel meant hand-writing a module that exports
 * `createKernel`; the shipped kernel could not be expressed as a revision at all,
 * which made "push a new kernel" a thing only tests did.
 *
 * The output is deliberately fed straight into `stageKernel`: what this prints is
 * a directory, and `KernelRevision.dir` is that directory.
 *
 * Default output is `.effect-bundles/`, beside the `kernel-state.json` the
 * runtime already keeps there, so a built kernel and the repo's record of which
 * kernel is active live in one place.
 */
import { compileKernelRevision, kernelBundleDir, KERNEL_MANIFEST } from "@effect-agent/effect-bundle"

const KERNEL_DIR = new URL("../apps/effect-server/src/kernel", import.meta.url).pathname
const outDir = process.argv[2] ?? ".effect-bundles"

const manifest = await compileKernelRevision({ kernelDir: KERNEL_DIR, outDir })
const dir = kernelBundleDir(outDir, manifest.bundleId)
console.log(`built ${manifest.bundleId} (effect ${manifest.abi}, needs ${manifest.bootstrapAbi})`)
console.log(`  artifact: ${dir}`)
console.log(`  manifest: ${dir}/${KERNEL_MANIFEST}`)

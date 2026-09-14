import {
  assertKernelCompat,
  BOOTSTRAP_ABI,
  KERNEL_ABI,
  type BootstrapCapability,
  type KernelDeclaration,
} from "@effect-agent/effect-bundle"

export const KERNEL: KernelDeclaration = {
  kernelId: "io.effect-agent.effect-server@0.0.0",
  abi: KERNEL_ABI,
  bootstrapAbi: BOOTSTRAP_ABI,
  runtimes: ["os"],
}

export const SHIPPED_REVISION = 1

export const HOST: BootstrapCapability = { bootstrapAbi: BOOTSTRAP_ABI, runtime: "os" }

export const assertKernelBootable = (
  declaration: KernelDeclaration = KERNEL,
  host: BootstrapCapability = HOST,
): KernelDeclaration => {
  assertKernelCompat(declaration, host)
  return declaration
}

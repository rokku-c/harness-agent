import { registerEffectApp } from "@effect-agent/effect-apps"
import type { EffectBundleApi } from "@effect-agent/effect-bundle"
import { effectApp } from "./effect-app.ts"
export const register = (api: EffectBundleApi) => registerEffectApp(api, effectApp)

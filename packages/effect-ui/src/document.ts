/**
 * UiDocument — a description-language-neutral UI document.
 *
 * A UI description may be authored in any supported description language:
 *   "effect-ui" (our declarative view spec),
 *   "json-render" (@json-render/core Spec),
 *   "html"       (raw HTML — a description language too).
 * Rendering and generation machinery work against this neutral document and
 * convert to whatever representation a given stage needs (spec for a mature
 * json-render client, or html for embedding), independent of the source
 * language.
 */

import { htmlRenderer } from "./html-renderer.ts"
import { viewToJsonSpec } from "./json-spec.ts"
import type { Spec } from "@json-render/core"
import type { EffectUiView } from "./spec.ts"

export type UiDocument =
  | { readonly lang: "effect-ui"; readonly view: EffectUiView }
  | { readonly lang: "json-render"; readonly spec: Spec }
  | { readonly lang: "html"; readonly html: string }

/** Project any document to a @json-render Spec when derivable. */
export const specOf = (doc: UiDocument): Spec | undefined => {
  switch (doc.lang) {
    case "effect-ui":
      return viewToJsonSpec(doc.view)
    case "json-render":
      return doc.spec
    case "html":
      return undefined
  }
}

/** Render any document to HTML when derivable (effect-ui and html). */
export const htmlOf = (doc: UiDocument): string | undefined => {
  switch (doc.lang) {
    case "html":
      return doc.html
    case "effect-ui":
      return htmlRenderer.render(doc.view)
    case "json-render":
      return undefined
  }
}

/** The description languages this document is representable in. */
export const languagesOf = (doc: UiDocument): readonly string[] => {
  const langs: string[] =
    doc.lang === "effect-ui" ? ["effect-ui", "json-render"] : doc.lang === "json-render" ? ["json-render"] : ["html"]
  if (htmlOf(doc) !== undefined && !langs.includes("html")) langs.push("html")
  return langs
}

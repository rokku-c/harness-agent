/-
  The model's index, and the build's root.

  `lake build` compiles this module's import closure and nothing else, so a module
  under `Formal/` that is missing from this list is never compiled — while
  `scripts/check-proofs.ts` still counts its theorems. `check:proofs` fails on that
  divergence rather than reporting a count over proofs it did not build.

  One import per module, alphabetical, so a missing one is visible.
-/

import Formal.AppLayer
import Formal.Authorize
import Formal.Authz
import Formal.CatalogLoad
import Formal.Chain
import Formal.Compat
import Formal.Config
import Formal.Consent
import Formal.Derive
import Formal.Egress
import Formal.Generation
import Formal.InFlight
import Formal.Lifecycle
import Formal.Match
import Formal.NodeGuard
import Formal.Presence
import Formal.Principals
import Formal.Queue
import Formal.Readout
import Formal.Redact
import Formal.Reload
import Formal.Resolve
import Formal.Rollup
import Formal.Rules
import Formal.Screen
import Formal.Sets
import Formal.Slot
import Formal.Surface
import Formal.Swap
import Formal.Token
import Formal.ToolKey
import Formal.TreeOrder
import Formal.UpstreamRewire
import Formal.Watch

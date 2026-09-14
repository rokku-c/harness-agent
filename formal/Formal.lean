/-
  The model's index, and the build's root.

  `lake build` compiles this module's import closure and nothing else, so a module
  under `Formal/` that is missing from this list is never compiled — while
  `scripts/check-proofs.ts` still counts its theorems. `check:proofs` fails on that
  divergence rather than reporting a count over proofs it did not build.

  One import per module, alphabetical, so a missing one is visible.
-/

import Formal.Adapt
import Formal.AppLayer
import Formal.Arming
import Formal.Authorize
import Formal.Authz
import Formal.Canonical
import Formal.CardVerdict
import Formal.CatalogLoad
import Formal.Chain
import Formal.Compat
import Formal.Config
import Formal.ConfigFetch
import Formal.Consent
import Formal.Credential
import Formal.Derive
import Formal.Door
import Formal.DoorAuth
import Formal.Egress
import Formal.Entry
import Formal.GateKey
import Formal.Generation
import Formal.InFlight
import Formal.Launch
import Formal.Lease
import Formal.Lifecycle
import Formal.Match
import Formal.NodeGuard
import Formal.PluginRoute
import Formal.PolicyScope
import Formal.Presence
import Formal.Preview
import Formal.Principals
import Formal.Query
import Formal.Queue
import Formal.Readout
import Formal.Reasons
import Formal.Redact
import Formal.Refresh
import Formal.Reload
import Formal.Replay
import Formal.Resolve
import Formal.Rollup
import Formal.Rules
import Formal.Screen
import Formal.ServerListings
import Formal.SetSource
import Formal.Sets
import Formal.Stack
import Formal.Surface
import Formal.Swap
import Formal.Timeline
import Formal.Token
import Formal.ToolKey
import Formal.TreeOrder
import Formal.UpstreamRewire
import Formal.Visibility
import Formal.Watch

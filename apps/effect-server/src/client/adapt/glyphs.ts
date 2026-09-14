/**
 * The glyphs a declared view may name.
 *
 * §8 pins one family, `@phosphor-icons/react`, and one glyph per concept,
 * reused. That is a **closed** list, and here it has to be one for a second
 * reason the design document could not have known: the package exports 3024
 * icons, and reaching them the way the design system is reached — a walk over
 * the library's exports — would mean importing all of them. A dynamic walk is
 * not tree-shakeable, and the console's bundle is a gate.
 *
 * So a glyph is named here once, imported by name, and the vocabulary stays
 * closed on purpose. `catalog.ts` resolves the design system's names openly
 * because that library owns its vocabulary; this one is ours to keep to the
 * concepts §8 lists, and a view naming a glyph that is not here does not
 * resolve — which is the intended answer, not a gap.
 *
 * Each import names the icon's own module rather than the package barrel, and
 * that is forced rather than fastidious: the barrel's `export * from
 * './csr/Check'` is extensionless, which `NodeNext` refuses to resolve, so a
 * name read from the barrel does not typecheck even though the bundler finds
 * it. Naming the module is what resolves, and it is also the narrowest thing to
 * import — one icon, not the family.
 *
 * Weight and size are not decided here. §8 fixes them by *context* — `bold`/12
 * inside a `Badge`, `regular`/14 in a dense row or cell, `regular`/16
 * elsewhere — and the context is the builder's to know, so a builder that puts
 * a glyph in a badge says so in the node's own props.
 */

import { ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise"
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut"
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft"
import { Check } from "@phosphor-icons/react/dist/csr/Check"
import { Desktop } from "@phosphor-icons/react/dist/csr/Desktop"
import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree"
import { Gear } from "@phosphor-icons/react/dist/csr/Gear"
import { Hourglass } from "@phosphor-icons/react/dist/csr/Hourglass"
import { House } from "@phosphor-icons/react/dist/csr/House"
import { Info } from "@phosphor-icons/react/dist/csr/Info"
import { Key } from "@phosphor-icons/react/dist/csr/Key"
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { Plugs } from "@phosphor-icons/react/dist/csr/Plugs"
import { Prohibit } from "@phosphor-icons/react/dist/csr/Prohibit"
import { Robot } from "@phosphor-icons/react/dist/csr/Robot"
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck"
import { Terminal } from "@phosphor-icons/react/dist/csr/Terminal"
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle"
import type { ComponentType } from "react"

/** One glyph per concept, §8's list and §3.3's five tone glyphs. */
export const glyphs: Readonly<Record<string, ComponentType<never>>> = {
  ArrowClockwise: ArrowClockwise as unknown as ComponentType<never>,
  ArrowSquareOut: ArrowSquareOut as unknown as ComponentType<never>,
  CaretLeft: CaretLeft as unknown as ComponentType<never>,
  Check: Check as unknown as ComponentType<never>,
  Desktop: Desktop as unknown as ComponentType<never>,
  DotsThree: DotsThree as unknown as ComponentType<never>,
  Gear: Gear as unknown as ComponentType<never>,
  Hourglass: Hourglass as unknown as ComponentType<never>,
  House: House as unknown as ComponentType<never>,
  Info: Info as unknown as ComponentType<never>,
  Key: Key as unknown as ComponentType<never>,
  ListBullets: ListBullets as unknown as ComponentType<never>,
  MagnifyingGlass: MagnifyingGlass as unknown as ComponentType<never>,
  Plugs: Plugs as unknown as ComponentType<never>,
  Prohibit: Prohibit as unknown as ComponentType<never>,
  Robot: Robot as unknown as ComponentType<never>,
  ShieldCheck: ShieldCheck as unknown as ComponentType<never>,
  Terminal: Terminal as unknown as ComponentType<never>,
  WarningCircle: WarningCircle as unknown as ComponentType<never>,
}

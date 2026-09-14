/**
 * The glyphs the console knows, and the only ones anything may name.
 *
 * §8 pins one family, `@phosphor-icons/react`, and one glyph per concept,
 * reused. That is a **closed** list, and here it has to be one for a second
 * reason the design document could not have known: the package exports 3024
 * icons, and reaching them the way the design system is reached — a walk over
 * the library's exports — would mean importing all of them. A dynamic walk is
 * not tree-shakeable, and the console's bundle is a gate.
 *
 * Two kinds of concept name a glyph here: §8's and §3.3's console concepts, and
 * the mark an app or a place declares for itself. A mark is a concept too — the
 * console draws it in a tile, and §8 rule 2 allows no textual stand-in in a
 * tile's mark, so a declared mark is a name from this table rather than a
 * character. An app picking a glyph from a list the console owns is the same
 * arrangement as an app picking a colour from Radix's, and it is why this file
 * holds no app id: adding an app adds no line here.
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
import { AppWindow } from "@phosphor-icons/react/dist/csr/AppWindow"
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut"
import { Books } from "@phosphor-icons/react/dist/csr/Books"
import { Brain } from "@phosphor-icons/react/dist/csr/Brain"
import { Browsers } from "@phosphor-icons/react/dist/csr/Browsers"
import { Cards } from "@phosphor-icons/react/dist/csr/Cards"
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft"
import { Chats } from "@phosphor-icons/react/dist/csr/Chats"
import { Check } from "@phosphor-icons/react/dist/csr/Check"
import { CircleHalf } from "@phosphor-icons/react/dist/csr/CircleHalf"
import { Desktop } from "@phosphor-icons/react/dist/csr/Desktop"
import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree"
import { Gear } from "@phosphor-icons/react/dist/csr/Gear"
import { GridFour } from "@phosphor-icons/react/dist/csr/GridFour"
import { Hourglass } from "@phosphor-icons/react/dist/csr/Hourglass"
import { House } from "@phosphor-icons/react/dist/csr/House"
import { Info } from "@phosphor-icons/react/dist/csr/Info"
import { Kanban } from "@phosphor-icons/react/dist/csr/Kanban"
import { Key } from "@phosphor-icons/react/dist/csr/Key"
import { Keyboard } from "@phosphor-icons/react/dist/csr/Keyboard"
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { Plugs } from "@phosphor-icons/react/dist/csr/Plugs"
import { Prohibit } from "@phosphor-icons/react/dist/csr/Prohibit"
import { Robot } from "@phosphor-icons/react/dist/csr/Robot"
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck"
import { Terminal } from "@phosphor-icons/react/dist/csr/Terminal"
import { Tray } from "@phosphor-icons/react/dist/csr/Tray"
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench"
import type { ComponentType } from "react"

const table = {
  AppWindow, ArrowClockwise, ArrowSquareOut, Books, Brain, Browsers, Cards, CaretLeft,
  Chats, Check, CircleHalf, Desktop, DotsThree, Gear, GridFour, Hourglass, House,
  Info, Kanban, Key, Keyboard, ListBullets, MagnifyingGlass, Plugs, Prohibit, Robot,
  ShieldCheck, Terminal, Tray, WarningCircle, Wrench,
}

/** One glyph per concept: §8's, §3.3's five tone glyphs, and the declared marks. */
export const glyphs: Readonly<Record<string, ComponentType<never>>> =
  table as unknown as Readonly<Record<string, ComponentType<never>>>

/** The vocabulary by name. A place's mark is typed by it; a declared mark is held to it by `check-ui.ts`. */
export const glyphNames: readonly string[] = Object.keys(table)
export type GlyphName = keyof typeof table

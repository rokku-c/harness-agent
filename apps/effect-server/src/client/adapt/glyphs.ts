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

export const glyphs: Readonly<Record<string, ComponentType<never>>> =
  table as unknown as Readonly<Record<string, ComponentType<never>>>

export const glyphNames: readonly string[] = Object.keys(table)
export type GlyphName = keyof typeof table

/**
 * The node builders the gateway console is written with.
 *
 * Every one of them is a shape the framework states once for every console — a
 * field is its label above its control, a section is a card, a list of records
 * is a table — so this file holds no opinion of its own: it names the ones this
 * app builds its page from, and nothing here is a second copy of them.
 */

export {
  cell,
  cellOf,
  chip,
  chipList,
  field,
  heading,
  line,
  list,
  listCard,
  section,
  stateBadge,
  table,
  text,
  type ListCard,
} from "@effect-agent/effect-ui"

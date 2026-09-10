import * as React from "react"
type Props = { title?: string; items?: Array<{ id: string; title: string }>; collapsed?: boolean; selected?: string }
const list = (items: Props["items"]) => items?.map((item) => <span key={item.id} data-ui-item={item.id}>{item.title}</span>)
export const TopBar = ({ props, children }: { props: Props; children?: React.ReactNode }) => <header className="ui-role-top-bar" data-ui-role="top-bar"><strong>{props.title}</strong>{children}</header>
export const Springboard = ({ props, children }: { props: Props; children?: React.ReactNode }) => <main className="ui-role-springboard" data-ui-role="springboard"><h1>{props.title ?? "Home"}</h1><div className="home-grid">{list(props.items)}{children}</div></main>
export const Dock = ({ props, children }: { props: Props; children?: React.ReactNode }) => <nav className="ui-role-dock" data-ui-role="dock" data-collapsed={props.collapsed ? "true" : "false"}>{list(props.items)}{children}</nav>
export const SettingsGroup = ({ props, children }: { props: Props; children?: React.ReactNode }) => <section className="ui-role-settings" data-ui-role="settings-group"><h2>{props.title ?? "Settings"}</h2><div>{list(props.items)}{children}</div></section>
export const BottomTab = ({ props, children }: { props: Props; children?: React.ReactNode }) => <nav className="ui-role-bottom-tab" data-ui-role="bottom-tab" data-selected={props.selected}>{list(props.items)}{children}</nav>

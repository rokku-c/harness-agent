/** Bottom-docked shell layer. Content and role styles stay in their own layers. */
export const consoleStylePlatform = `
:root{--shell-status-height:30px;--shell-dock-height:112px;--shell-dock-bottom:14px;--shell-radius:26px;--shell-accent:var(--accent,#178A5C);--shell-surface:var(--surface,#fff);--shell-bg:var(--bg,#f5f5f7);--shell-line:var(--line,#d2d2d7);--shell-shadow:var(--shadow-strong,rgba(0,0,0,.18))}
html,body{width:100%;height:100%;min-height:100%;margin:0;overflow:hidden;overscroll-behavior:none}
body{background:var(--shell-bg);color:var(--ink,#1d1d1f)}
.status-bar{position:relative;z-index:40;height:var(--shell-status-height);min-height:var(--shell-status-height);box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 12px;background:color-mix(in srgb,var(--shell-surface) 88%,transparent);border-bottom:1px solid var(--shell-line);backdrop-filter:blur(20px);font-size:11px}
.status-home,.status-theme{width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:8px;background:transparent;color:var(--muted,#6e6e73);font:15px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer}
.status-home{color:var(--shell-accent)}
.status-home.on,.status-home:hover,.status-theme:hover{background:color-mix(in srgb,var(--shell-accent) 12%,transparent);color:var(--shell-accent)}
.status-title{font-weight:600;color:var(--ink,#1d1d1f)}
.status-state{min-width:0;overflow:hidden;color:var(--muted,#6e6e73);text-overflow:ellipsis;white-space:nowrap}
.status-time{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--faint,#8e8e93)}
.c-body{position:relative;width:100%;height:calc(100dvh - var(--shell-status-height));min-height:0;margin-left:0;overflow:hidden}
.c-panel{width:100%;height:100%;min-height:0;padding:0;overflow:auto;overscroll-behavior:contain;background:var(--shell-bg);scrollbar-width:none}
body[data-shell-view="home"] .c-panel{padding-bottom:calc(var(--shell-dock-height) + var(--shell-dock-bottom) + 22px)}
.c-panel::-webkit-scrollbar{display:none}
.view-surface,.view-embed,.view-spec{width:100%;height:100%;min-height:100%}
.view-embed iframe{display:block;width:100%;height:100%;min-height:100%;border:0;background:var(--shell-surface)}
#rail.c-nav{position:fixed;z-index:30;left:50%;bottom:max(var(--shell-dock-bottom),env(safe-area-inset-bottom));display:none;align-items:flex-start;gap:8px;width:max-content;max-width:calc(100vw - 20px);height:var(--shell-dock-height);padding:12px 14px;box-sizing:border-box;transform:translateX(-50%);border:1px solid color-mix(in srgb,var(--shell-line) 76%,transparent);border-radius:var(--shell-radius);background:color-mix(in srgb,var(--shell-surface) 86%,transparent);box-shadow:0 14px 38px var(--shell-shadow);backdrop-filter:blur(24px) saturate(1.35);overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
body[data-shell-view="home"] #rail.c-nav{display:flex}
#rail.c-nav::-webkit-scrollbar{display:none}
#rail .app-link{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;flex:none;width:86px;height:88px;min-height:88px;padding:0;border:0;border-radius:18px;background:transparent;color:var(--ink,#1d1d1f);cursor:pointer;transition:transform .18s,background .18s}
#rail .app-link .app-icon{display:grid;place-items:center;width:68px;height:68px;border:0;border-radius:17px;background:linear-gradient(180deg,var(--shell-accent),color-mix(in srgb,var(--shell-accent) 78%,#000));color:var(--accent-ink,#fff);font:700 27px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 6px 14px var(--shadow,rgba(0,0,0,.16))}
#rail .app-link[data-app-id="board"] .app-icon{background:linear-gradient(180deg,#34c759,#1f8f45)}
#rail .app-link[data-app-id="mcp-registry"] .app-icon{background:linear-gradient(180deg,#5ac8fa,#0a84ff)}
#rail .app-link[data-app-id="mcp-gateway"] .app-icon{background:linear-gradient(180deg,#64d2ff,#007aff)}
#rail .app-link[data-app-id="ai-gateway"] .app-icon{background:linear-gradient(180deg,#ff9f0a,#ff453a)}
#rail .app-link[data-app-id="agentd"] .app-icon{background:linear-gradient(180deg,#8e8e93,#48484a)}
#rail .app-link[data-app-id="mantis"] .app-icon{background:linear-gradient(180deg,#ff375f,#bf1740)}
#rail .app-link[data-app-id="platform-network"] .app-icon{background:linear-gradient(180deg,#30d158,#0b7f45)}
#rail .app-link[data-app-id="settings"] .app-icon{background:linear-gradient(180deg,#a1a1a6,#636366)}
#rail .more-link .app-icon{background:linear-gradient(180deg,#a1a1a6,#636366);font-size:18px}
#rail .app-link span:not(.app-icon){display:block;max-width:86px;font-size:12px;font-weight:600;line-height:1.15;text-align:center;overflow-wrap:anywhere;white-space:normal}
#rail .app-link:hover{background:var(--surface-3,rgba(0,0,0,.06));transform:translateY(-3px)}
#rail .app-link.on{background:color-mix(in srgb,var(--shell-accent) 12%,transparent)}
#rail .app-link.on::after{content:"";position:absolute;bottom:-5px;width:5px;height:5px;border-radius:50%;background:var(--shell-accent)}
#rail .dock-divider{flex:none;width:1px;height:34px;margin:0 3px;background:var(--shell-line)}
.shell-menu{display:none;position:fixed;z-index:30;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:58px;height:58px;place-items:center;padding:0;border:1px solid color-mix(in srgb,var(--shell-line) 76%,transparent);border-radius:50%;background:color-mix(in srgb,var(--shell-surface) 90%,transparent);box-shadow:0 12px 30px var(--shell-shadow);backdrop-filter:blur(22px) saturate(1.35);color:var(--shell-accent);font:24px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer}
body[data-shell-view="app"] .shell-menu{display:grid}
@media(max-width:700px){.status-bar{padding:0 10px}.status-state,.status-home{display:none}.c-body{width:100%!important;margin-left:0!important}body[data-shell-view="app"] .c-panel{padding-bottom:calc(76px + env(safe-area-inset-bottom))}#rail.c-nav{gap:4px;height:100px;padding:10px 6px}body[data-shell-view="home"] .c-panel{padding-bottom:calc(100px + var(--shell-dock-bottom) + 18px)}#rail .app-link{width:72px;height:80px;min-height:80px;border-radius:15px}#rail .app-link .app-icon{width:64px;height:64px;border-radius:16px;font-size:24px}#rail .app-link span:not(.app-icon){max-width:72px;font-size:10px;line-height:1.1}body[data-shell-view="app"] .shell-menu{display:grid}}
@media(max-width:420px){.status-title{max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.shell-menu{width:54px;height:54px}}
@media(prefers-reduced-motion:reduce){#rail .app-link{transition:none}}
`

export const consoleStyle: string = `
:root{color-scheme:light;--paper:#f9f9f6;--ink:#182329;--muted:#7a8588;--line:#e1e6e3;--green:#146b51;--tint:#e7f2eb}
*{box-sizing:border-box}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--paper);color:var(--ink)}
header{height:66px;display:flex;align-items:center;gap:12px;padding:0 26px;border-bottom:1px solid var(--line);background:#fff}
.brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--green);color:#fff;font-size:19px}
header b{font-size:17px;letter-spacing:-.6px}header span:last-child{font:10px ui-monospace,monospace;letter-spacing:2px;color:var(--muted);margin-left:10px}
main{display:grid;grid-template-columns:242px minmax(0,1fr);min-height:calc(100vh - 66px)}
nav{border-right:1px solid var(--line);padding:18px 12px;background:#f0f3ee;display:flex;flex-direction:column;gap:4px}
nav h3{font:10px ui-monospace,monospace;letter-spacing:1.6px;color:var(--muted);margin:20px 12px 9px}
button{font:inherit;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);padding:9px 14px;cursor:pointer;transition:background .15s}
button:hover{background:#f0f5f0}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #248866;outline-offset:2px}
.app-link{display:flex;align-items:center;gap:11px;text-align:left;border:0;background:transparent;padding:9px 11px;font-size:13px;overflow-wrap:anywhere}
.app-link.on{background:#fff;color:var(--green);box-shadow:0 1px 5px #173c2410;font-weight:600}
.app-icon{flex:none;display:grid;place-items:center;width:27px;height:27px;border:1px solid #dce4dd;border-radius:7px;color:var(--muted);font:11px ui-monospace,monospace}
.on .app-icon{background:var(--tint);border-color:#c9dfd0;color:var(--green)}#panel{min-width:0}
.bar{height:53px;display:flex;align-items:center;gap:18px;padding:0 30px;border-bottom:1px solid var(--line);background:#ffffff90}.bar b{font-size:13px}
.sub{font:10px ui-monospace,monospace;color:var(--muted);letter-spacing:.7px}.pad{padding:28px 36px}.frame-wrap{height:calc(100vh - 119px)}
iframe{width:100%;height:100%;border:0;display:block;background:#fff}.config-page{max-width:1040px}.config-heading h1{font-size:27px;letter-spacing:-1px;margin:3px 0 8px}
.config-heading p{color:var(--muted);font-size:13px;margin:0 0 24px}.config-status{display:flex;align-items:center;flex-wrap:wrap;gap:9px 16px;padding:16px 18px;border:1px solid #c9dfd0;border-radius:10px;background:#edf6ef}
.config-status strong{font-size:12px;color:var(--green)}.config-status span{flex:1;min-width:180px;font-size:12px;color:#657b6c}.config-status small{font:10px ui-monospace,monospace;color:var(--muted)}
.config-status[data-tone=pending]{background:#fff8e7;border-color:#ecddb3}.config-status[data-tone=pending] strong{color:#956419}.config-status[data-tone=error]{background:#fff2ef;border-color:#eccac2}
.config-status [data-apply]{font-size:12px;padding:6px 10px}.config-feedback{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--green);margin:13px 0}.config-feedback:empty{display:none}
[data-tone=error]{color:#ad382f}.cfg{margin-top:23px}.cfg-editor,.cfg-block-fields{border:0;padding:0;margin:0;min-width:0}.cfg-editor{display:flex;flex-direction:column;gap:20px}
.cfg-field{display:flex;flex-direction:column;gap:8px;min-width:0}.cfg-top{display:flex;align-items:center;gap:9px}.cfg-top label,.cfg-top h3{font-size:12px;font-weight:600;margin:0}
.cfg-top code{font:10px ui-monospace,monospace;color:var(--muted);margin-left:auto}.cfg-src{font:9px ui-monospace,monospace;padding:2px 5px;border-radius:4px;background:#eaf0eb;color:#748779}
.cfg input:not([type=checkbox]),.cfg select{width:100%;font:13px ui-monospace,monospace;padding:10px 12px;border:1px solid #d7dfd9;border-radius:7px;background:#fff;color:var(--ink);min-width:0}
.cfg input[type=checkbox]{width:16px;height:16px;accent-color:var(--green);margin:0}.cfg-help{margin:0;color:var(--muted);font-size:11px;line-height:1.6}.cfg-array{display:flex;flex-direction:column;gap:12px}
.cfg-block{border:1px solid #d6e1d9;border-radius:11px;background:#fff;overflow:hidden;box-shadow:0 2px 3px #24322403}.cfg-block-top{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;background:#f4f8f3;border-bottom:1px solid #e5ece4}
.cfg-toggle{display:flex;align-items:center;gap:11px;font:600 13px ui-monospace,monospace;cursor:pointer}.cfg-block-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;padding:19px}
.cfg-block>.cfg-help{padding:0 19px 15px}.cfg-block.is-disabled .cfg-block-fields{opacity:.5}.cfg-block.is-disabled .cfg-block-top{background:#f7f8f6}.cfg-object{border:1px solid var(--line);border-radius:9px;padding:18px;display:grid;gap:15px}
.cfg-actions{display:flex;flex-wrap:wrap;gap:9px;padding:23px 0;border-top:1px solid var(--line);margin-top:25px}.cfg-actions [data-strategy=apply]{background:var(--green);color:#fff;border-color:var(--green)}
.cfg-actions [data-strategy=apply]:hover{background:#105841}.cfg-actions [data-action=reload]{margin-right:auto;color:var(--muted)}[hidden]{display:none!important}
@media(max-width:760px){main{grid-template-columns:175px minmax(0,1fr)}.pad{padding:23px 20px}.bar{padding:0 20px}.bar .sub{display:none}.cfg-block-fields{grid-template-columns:1fr}.cfg-top{flex-wrap:wrap}.cfg-top code{margin-left:0}.config-status span{min-width:100%}}
@media(max-width:520px){header{padding:0 16px;height:56px}main{display:block}nav{flex-direction:row;overflow:auto;padding:9px;border-right:0;border-bottom:1px solid var(--line)}nav h3{display:none}.app-link{flex:none;padding:6px;font-size:12px}.app-icon{display:none}.pad{padding:20px 14px}.cfg-actions button{flex:1}.cfg-actions [data-action=reload]{flex-basis:100%}.frame-wrap{height:calc(100vh - 155px)}}
`

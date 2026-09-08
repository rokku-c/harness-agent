export const shell = (body: string, basePath: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>UI Canvas</title>
<style>body{font:16px system-ui;margin:2rem}section[data-canvas-ref]{cursor:pointer;padding:.5rem;border:1px dashed #888}#back{margin-bottom:1rem}</style>
</head><body><button id="back" hidden>Back</button><div id="app">${body}</div>
<script type="module" src="${basePath}/canvas.js"></script></body></html>`

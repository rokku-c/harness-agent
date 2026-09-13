const CSS_TOKEN = "/*__PAGE_CSS__*/"
const CLIENT_TOKEN = "/*__PAGE_CLIENT__*/"

export interface HtmlPageAssets {
  readonly html: string
  readonly css: string
  readonly client: string
}

export interface HtmlPage {
  readonly html: string
  respond(request: Request): Response | undefined
}

export const composeHtmlPage = (assets: HtmlPageAssets): string => {
  if (!assets.html.includes(CSS_TOKEN)) throw new Error(`html page is missing ${CSS_TOKEN}`)
  if (!assets.html.includes(CLIENT_TOKEN)) throw new Error(`html page is missing ${CLIENT_TOKEN}`)
  return assets.html.replace(CSS_TOKEN, assets.css).replace(CLIENT_TOKEN, assets.client)
}

export const defineHtmlPage = (assets: HtmlPageAssets): HtmlPage => {
  const html = composeHtmlPage(assets)
  return {
    html,
    respond: (request) => request.headers.get("accept")?.includes("text/html") === true
      ? new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
      : undefined,
  }
}

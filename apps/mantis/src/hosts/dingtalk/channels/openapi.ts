/**
 * DingTalk openapi helpers shared by the robot channel and the card layer:
 * access-token fetching (cached, like the original clawyp) + API root.
 */
export const DINGTALK_API = "https://api.dingtalk.com"

const tokenCache = new Map<string, { token: string; expiryMs: number }>()

/** bot access token from the app credentials (cached until near expiry) */
export const robotAccessToken = async (clientId: string, clientSecret: string): Promise<string> => {
  const cached = tokenCache.get(clientId)
  if (cached !== undefined && cached.expiryMs > Date.now() + 60_000) return cached.token
  const response = await fetch(DINGTALK_API + "/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey: clientId, appSecret: clientSecret })
  })
  const data = (await response.json()) as { accessToken?: string; expireIn?: number; message?: string }
  if (!response.ok || data.accessToken === undefined)
    throw new Error("dingtalk token failed: " + (data.message ?? response.status))
  tokenCache.set(clientId, { token: data.accessToken, expiryMs: Date.now() + Number(data.expireIn ?? 7200) * 1000 })
  return data.accessToken
}

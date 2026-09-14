export const deepLink = (): string => window.location.href

export const copyDeepLink = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(deepLink())
    return true
  } catch {
    return false
  }
}

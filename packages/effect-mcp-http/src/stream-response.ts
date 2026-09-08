export const closeAfterStream = (response: Response, close: () => Promise<void>): Response => {
  if (!response.body) return response
  let finished = false
  const finish = async (): Promise<void> => { if (!finished) { finished = true; await close() } }
  const reader = response.body.getReader()
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const item = await reader.read()
        if (item.done) { await finish(); controller.close() } else controller.enqueue(item.value)
      } catch (error) { await finish(); controller.error(error) }
    },
    async cancel(reason) { try { await reader.cancel(reason) } finally { await finish() } },
  })
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

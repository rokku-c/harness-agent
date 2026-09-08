export const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export const plane = (stop?: () => void | Promise<void>, body = "ready") => ({
  canHandle: () => true,
  handle: async () => new Response(body),
  stop,
})

export const request = (path = "/", method = "GET") => new Request("http://localhost" + path, { method })

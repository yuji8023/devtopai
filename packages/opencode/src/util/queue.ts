export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []
  private closed = false

  constructor(
    private readonly maxSize = 256,
  ) {}

  /**
   * 返回：
   *  true  -> 入队成功
   *  false -> 队列已满或已关闭
   */
  push(item: T): boolean {
    if (this.closed) {
      return false
    }

    const resolve = this.resolvers.shift()

    if (resolve) {
      resolve(item)
      return true
    }

    if (this.queue.length >= this.maxSize) {
      return false
    }

    this.queue.push(item)
    return true
  }

  close() {
    this.closed = true

    while (this.resolvers.length) {
      this.resolvers.shift()!(undefined as never)
    }
  }

  async next(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!
    }

    if (this.closed) {
      throw new Error("Queue closed")
    }

    return new Promise((resolve) => {
      this.resolvers.push(resolve)
    })
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      try {
        yield await this.next()
      } catch {
        return
      }
    }
  }

  get size() {
    return this.queue.length
  }

  get capacity() {
    return this.maxSize
  }
}

export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}

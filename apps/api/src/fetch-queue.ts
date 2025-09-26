interface QueueTask {
  path: string;
  priority: number;
  resolve: (value: string | null) => void;
  reject: (error: unknown) => void;
}

export class FetchQueue {
  private readonly queue: QueueTask[] = [];
  private inFlight = 0;

  constructor(
    private readonly fetcher: (path: string) => Promise<string | null>,
    private readonly maxConcurrent = 4
  ) {}

  enqueue(path: string, priority = 0): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.queue.push({ path, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.inFlight >= this.maxConcurrent) {
      return;
    }

    const task = this.queue.shift();
    if (!task) {
      return;
    }

    this.inFlight++;

    this.fetcher(task.path)
      .then(result => {
        task.resolve(result);
      })
      .catch(error => {
        task.reject(error);
      })
      .finally(() => {
        this.inFlight--;
        this.processNext();
      });
  }
}

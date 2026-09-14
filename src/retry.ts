export interface RetryOptions {
  retries?: number;
  delay?: number;
  maxDelay?: number;
  jitter?: boolean;
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      cleanup();
      reject(signal?.reason);
    }

    function cleanup(): void {
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function applyJitter(delay: number): number {
  return Math.random() * delay;
}

function validateOptions(
  fn: unknown,
  retries: number,
  delay: number,
  maxDelay: number,
  jitter: boolean,
  signal?: AbortSignal,
): void {
  if (typeof fn !== "function") {
    throw new TypeError("retry: fn must be a function");
  }

  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError("retry: retries must be a non-negative integer");
  }

  if (!Number.isFinite(delay) || delay < 0) {
    throw new RangeError("retry: delay must be a non-negative finite number");
  }

  if (maxDelay !== Infinity && (!Number.isFinite(maxDelay) || maxDelay < 0)) {
    throw new RangeError(
      "retry: maxDelay must be a non-negative finite number",
    );
  }

  if (maxDelay < delay) {
    throw new RangeError(
      "retry: maxDelay must be greater than or equal to delay",
    );
  }

  if (typeof jitter !== "boolean") {
    throw new TypeError("retry: jitter must be a boolean");
  }

  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw new TypeError("retry: signal must be an AbortSignal");
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    delay = 500,
    maxDelay = Infinity,
    jitter = false,
    signal,
  } = options;

  validateOptions(fn, retries, delay, maxDelay, jitter, signal);

  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw signal.reason;
    }

    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      const backoffDelay = Math.min(delay * 2 ** attempt, maxDelay);

      const actualDelay = jitter ? applyJitter(backoffDelay) : backoffDelay;

      await sleep(actualDelay, signal);

      attempt++;
    }
  }
}

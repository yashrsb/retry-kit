import { describe, expect, it, vi } from "vitest";
import { retry } from "../src/retry.js";

describe("retry", () => {
  it("returns the result when the operation succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await retry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("retries when the operation fails", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("failure 1"))
      .mockRejectedValueOnce(new Error("failure 2"))
      .mockResolvedValue("success");

    const result = await retry(fn, {
      retries: 3,
      delay: 10,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("throws after all retries are exhausted", async () => {
    const error = new Error("database unavailable");

    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      retry(fn, {
        retries: 3,
        delay: 10,
      }),
    ).rejects.toThrow("database unavailable");

    expect(fn).toHaveBeenCalledTimes(4);
  });
  it("uses exponential backoff between retries", async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("failure 1"))
      .mockRejectedValueOnce(new Error("failure 2"))
      .mockRejectedValueOnce(new Error("failure 3"))
      .mockResolvedValue("success");

    const retryPromise = retry(fn, {
      retries: 3,
      delay: 500,
    });

    // First attempt happens immediately.
    await vi.waitFor(() => {
      expect(fn).toHaveBeenCalledTimes(1);
    });

    // First retry should wait 500ms.
    await vi.advanceTimersByTimeAsync(500);

    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry should wait 1000ms.
    await vi.advanceTimersByTimeAsync(1000);

    expect(fn).toHaveBeenCalledTimes(3);

    // Third retry should wait 2000ms.
    await vi.advanceTimersByTimeAsync(2000);

    expect(fn).toHaveBeenCalledTimes(4);

    await expect(retryPromise).resolves.toBe("success");

    vi.useRealTimers();
  });
  it("waits before each retry using exponential backoff", async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("failure 1"))
      .mockRejectedValueOnce(new Error("failure 2"))
      .mockRejectedValueOnce(new Error("failure 3"))
      .mockResolvedValue("success");

    const retryPromise = retry(fn, {
      retries: 3,
      delay: 500,
    });

    expect(fn).toHaveBeenCalledTimes(1);

    // Only 499ms have passed.
    await vi.advanceTimersByTimeAsync(499);

    expect(fn).toHaveBeenCalledTimes(1);

    // Now the first 500ms delay has completed.
    await vi.advanceTimersByTimeAsync(1);

    expect(fn).toHaveBeenCalledTimes(2);

    // 999ms is not enough for the second retry.
    await vi.advanceTimersByTimeAsync(999);

    expect(fn).toHaveBeenCalledTimes(2);

    // Complete the remaining 1ms.
    await vi.advanceTimersByTimeAsync(1);

    expect(fn).toHaveBeenCalledTimes(3);

    // Third delay = 2000ms.
    await vi.advanceTimersByTimeAsync(2000);

    expect(fn).toHaveBeenCalledTimes(4);

    await expect(retryPromise).resolves.toBe("success");

    vi.useRealTimers();
  });
  it("throws when fn is not a function", async () => {
    await expect(retry("hello")).rejects.toThrow(
      "retry: fn must be a function",
    );
  });

  it("throws when retries is negative", async () => {
    await expect(
      retry(() => {}, {
        retries: -1,
      }),
    ).rejects.toThrow("retry: retries must be a non-negative integer");
  });

  it("throws when retries is not an integer", async () => {
    await expect(
      retry(() => {}, {
        retries: 1.5,
      }),
    ).rejects.toThrow("retry: retries must be a non-negative integer");
  });

  it("throws when delay is negative", async () => {
    await expect(
      retry(() => {}, {
        delay: -100,
      }),
    ).rejects.toThrow("retry: delay must be a non-negative finite number");
  });

  it("throws when delay is not finite", async () => {
    await expect(
      retry(() => {}, {
        delay: Infinity,
      }),
    ).rejects.toThrow("retry: delay must be a non-negative finite number");
  });
  it("runs only once when retries is 0", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(
      retry(fn, {
        retries: 0,
        delay: 10,
      }),
    ).rejects.toThrow("failure");

    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("applies full jitter to the backoff delay", async () => {
    vi.useFakeTimers();

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("failure 1"))
      .mockResolvedValue("success");

    const retryPromise = retry(fn, {
      retries: 1,
      delay: 1000,
      jitter: true,
    });

    expect(fn).toHaveBeenCalledTimes(1);

    // Jittered delay:
    // 1000 * 0.5 = 500ms
    await vi.advanceTimersByTimeAsync(499);

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(fn).toHaveBeenCalledTimes(2);

    await expect(retryPromise).resolves.toBe("success");
  });
  it("throws when signal is not an AbortSignal", async () => {
    await expect(
      retry(async () => "success", {
        signal: "invalid",
      }),
    ).rejects.toThrow("retry: signal must be an AbortSignal");
  });
  it("does not execute fn when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const fn = vi.fn().mockResolvedValue("success");

    await expect(
      retry(fn, {
        signal: controller.signal,
      }),
    ).rejects.toBe(controller.signal.reason);

    expect(fn).not.toHaveBeenCalled();
  });
});

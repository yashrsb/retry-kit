# retry-kit

A small TypeScript utility for retrying failed asynchronous operations with exponential backoff.

[![npm version](https://img.shields.io/npm/v/@yashrsb/retry-kit.svg)](https://www.npmjs.com/package/@yashrsb/retry-kit)
[![npm downloads](https://img.shields.io/npm/dm/@yashrsb/retry-kit.svg)](https://www.npmjs.com/package/@yashrsb/retry-kit)
[![License](https://img.shields.io/npm/l/@yashrsb/retry-kit.svg)](https://github.com/yashrsb/retry-kit/blob/main/LICENSE)

## Installation

```bash
npm install @yashrsb/retry-kit
```

## Usage

```ts
import { retry } from "@yashrsb/retry-kit";

const result = await retry(
  async () => {
    return await fetchData();
  },
  {
    retries: 3,
    delay: 500,
    maxDelay: 5000,
    jitter: true,
  },
);

console.log(result);
```

If the operation fails, `@yashrsb/retry-kit` waits before trying again.

With the configuration above, the base exponential delays are:

```text
500ms → 1000ms → 2000ms → 4000ms
```

The `maxDelay` option limits the maximum wait time.

When `jitter` is enabled, the actual delay is randomized between `0` and the calculated backoff delay.

## API

### `retry<T>(fn, options?)`

Retries an asynchronous operation until it succeeds or the configured number of retries is exhausted.

### Options

| Option     |     Default | Description                                               |
| ---------- | ----------: | --------------------------------------------------------- |
| `retries`  |         `3` | Number of retries after the initial attempt               |
| `delay`    |       `500` | Initial delay in milliseconds                             |
| `maxDelay` |  `Infinity` | Maximum delay between attempts                            |
| `jitter`   |     `false` | Randomizes the backoff delay                              |
| `signal`   | `undefined` | Optional `AbortSignal` used to cancel the retry operation |

### Example: Retry a failing operation

```ts
const result = await retry(
  async () => {
    return await fetchData();
  },
  {
    retries: 3,
    delay: 500,
  },
);
```

The operation is attempted once initially. If it fails, it can be retried up to three additional times.

Therefore:

```text
retries: 3
```

means a maximum of:

```text
4 total attempts
```

### Example: Exponential backoff

With:

```ts
{
  retries: 4,
  delay: 500,
}
```

the delays between attempts are:

```text
500ms
1000ms
2000ms
4000ms
```

### Example: Maximum delay

```ts
{
  retries: 10,
  delay: 500,
  maxDelay: 2000,
}
```

The delay will never exceed `2000ms`:

```text
500ms
1000ms
2000ms
2000ms
2000ms
...
```

### Example: Jitter

```ts
{
  retries: 5,
  delay: 500,
  jitter: true,
}
```

Jitter randomizes the calculated backoff delay. This can help avoid many clients retrying at exactly the same time.

### Example: Cancellation

```ts
const controller = new AbortController();

const result = retry(
  async () => {
    return await fetchData();
  },
  {
    retries: 5,
    delay: 500,
    signal: controller.signal,
  },
);

controller.abort();
```

Aborting the signal stops the retry operation.

## Behavior

The package:

- Executes the operation immediately.
- Retries rejected operations according to the configured retry count.
- Uses exponential backoff between retries.
- Supports a maximum backoff delay.
- Supports full jitter.
- Preserves and throws the final operation error when retries are exhausted.
- Supports cancellation through `AbortSignal`.
- Provides TypeScript declarations.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the package:

```bash
npm run build
```

## Package

Published on npm:

**[@yashrsb/retry-kit](https://www.npmjs.com/package/@yashrsb/retry-kit)**

## License

MIT

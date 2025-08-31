/**
 * Utility functions to reduce deeply nested control flow
 * Provides functional programming patterns to flatten nested logic
 */

export type Predicate<T> = (value: T) => boolean;
export type Transform<T, U> = (value: T) => U;
export type AsyncTransform<T, U> = (value: T) => Promise<U>;

/**
 * Execute a series of operations with early exit on failure
 */
export async function pipeline<T>(
  initialValue: T,
  ...operations: Array<AsyncTransform<T, T>>
): Promise<T> {
  let result = initialValue;

  for (const operation of operations) {
    result = await operation(result);
  }

  return result;
}

/**
 * Conditional execution - only run if predicate is true
 */
export function when<T>(
  predicate: Predicate<T>,
  transform: Transform<T, T>
): Transform<T, T> {
  return (value: T) => (predicate(value) ? transform(value) : value);
}

/**
 * Async conditional execution
 */
export function whenAsync<T>(
  predicate: Predicate<T>,
  transform: AsyncTransform<T, T>
): AsyncTransform<T, T> {
  return async (value: T) =>
    predicate(value) ? await transform(value) : value;
}

/**
 * Try-catch wrapper that returns a result type
 */
export async function tryAsync<T, E = Error>(
  operation: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: E }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as E };
  }
}

/**
 * Execute operations in sequence, stopping on first failure
 */
export async function sequence<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];

  for (const operation of operations) {
    const result = await operation();
    results.push(result);
  }

  return results;
}

/**
 * Execute operations with fallback on failure
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch {
    return await fallback();
  }
}

/**
 * Flatten nested conditionals into a chain
 */
export class ConditionalChain<T> {
  private value: T;
  private executed = false;

  constructor(value: T) {
    this.value = value;
  }

  static of<T>(value: T): ConditionalChain<T> {
    return new ConditionalChain(value);
  }

  when(
    predicate: Predicate<T>,
    transform: Transform<T, T>
  ): ConditionalChain<T> {
    if (!this.executed && predicate(this.value)) {
      this.value = transform(this.value);
      this.executed = true;
    }
    return this;
  }

  whenAsync(
    predicate: Predicate<T>,
    transform: AsyncTransform<T, T>
  ): AsyncConditionalChain<T> {
    return new AsyncConditionalChain(this.value, this.executed).whenAsync(
      predicate,
      transform
    );
  }

  otherwise(transform: Transform<T, T>): T {
    if (!this.executed) {
      return transform(this.value);
    }
    return this.value;
  }

  get(): T {
    return this.value;
  }
}

/**
 * Async version of ConditionalChain
 */
export class AsyncConditionalChain<T> {
  private valuePromise: Promise<T>;
  private executedPromise: Promise<boolean>;

  constructor(value: T | Promise<T>, executed: boolean = false) {
    this.valuePromise = Promise.resolve(value);
    this.executedPromise = Promise.resolve(executed);
  }

  static of<T>(value: T | Promise<T>): AsyncConditionalChain<T> {
    return new AsyncConditionalChain(value);
  }

  whenAsync(
    predicate: Predicate<T>,
    transform: AsyncTransform<T, T>
  ): AsyncConditionalChain<T> {
    const newValuePromise = Promise.all([
      this.valuePromise,
      this.executedPromise,
    ]).then(async ([value, executed]) => {
      if (!executed && predicate(value)) {
        return await transform(value);
      }
      return value;
    });

    const newExecutedPromise = Promise.all([
      this.valuePromise,
      this.executedPromise,
    ]).then(([value, executed]) => executed || predicate(value));

    const chain = new AsyncConditionalChain(newValuePromise);
    chain.executedPromise = newExecutedPromise;
    return chain;
  }

  async otherwise(transform: AsyncTransform<T, T>): Promise<T> {
    const [value, executed] = await Promise.all([
      this.valuePromise,
      this.executedPromise,
    ]);
    if (!executed) {
      return await transform(value);
    }
    return value;
  }

  async get(): Promise<T> {
    return await this.valuePromise;
  }
}

/**
 * Reduce nested loops with functional approach
 */
export function flatMap<T, U>(
  array: T[],
  transform: (item: T, index: number) => U[]
): U[] {
  return array.reduce((acc, item, index) => {
    return acc.concat(transform(item, index));
  }, [] as U[]);
}

/**
 * Process items with early termination
 */
export function processUntil<T>(
  items: T[],
  processor: (item: T, index: number) => boolean,
  predicate: (item: T, index: number) => boolean
): T[] {
  const processed: T[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (predicate(item, i)) {
      break;
    }

    if (processor(item, i)) {
      processed.push(item);
    }
  }

  return processed;
}

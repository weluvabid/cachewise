# Concurrency and async computation

JavaScript execution is single-threaded within a given agent, but asynchronous factories can overlap. Cachewise uses single-flight coordination to avoid starting duplicate factories for the same key.

## Single-flight lifecycle

For `getOrCompute(key, factory, options)`:

1. Cachewise checks for a live cached value.
2. If there is no value, it looks for an existing in-flight operation for the key.
3. If no flight exists, it creates an `AbortController`, invokes the factory in a promise continuation, and stores the resulting promise.
4. Every caller increments the flight's waiter count and awaits the shared promise.
5. A caller's `options.signal` cancels only that caller's wait.
6. When a caller leaves, its waiter count is decremented. If it was the final waiter, Cachewise aborts and removes the flight.

The factory receives the shared signal, not any caller's signal.

## Cancellation is cooperative

Aborting an `AbortSignal` is a notification. It cannot forcibly stop arbitrary JavaScript work. A factory must observe the signal and stop its own work if it can.

If a caller cancels, that caller rejects with an `AbortError`. Other callers continue waiting. If every caller leaves, Cachewise aborts the shared signal. A factory that ignores the signal may continue running, and its promise may still settle later.

A factory's eventual result is returned to callers that are still awaiting it. It is cached only if the flight was not aborted, was not invalidated by a later accepted `set` or `delete`, and the cache-wide epoch is unchanged.

## Invalidation races

`delete(key)` marks an existing flight for that key as non-cacheable, even if there is no retained entry to delete. An accepted `set(key, value)` does the same before committing the new value. This prevents an older in-flight computation from overwriting a newer explicit value. The invalidation marker lives on the flight itself; Cachewise does not retain a separate historical version entry for every key ever seen.

`clear()` increments a cache-wide epoch, aborts known flights, clears the flight map, and removes retained entries. A factory that settles after the clear sees an old epoch and cannot repopulate the cache.

These checks protect cache state. They do not cancel external side effects already performed by a factory.

## Undefined values

`get` uses `undefined` to represent a miss. `getOrCompute` additionally calls `has` to distinguish a cached `undefined` value from a missing entry. This allows `getOrCompute` to cache `undefined`, although callers using `get` alone cannot distinguish that cached value from a miss.

## Callback behavior

`onDispose` and `onEvent` are synchronous callbacks. They run as part of the operation that emits the event or disposes the value. Keep them short and avoid blocking work.

Exceptions thrown by `onDispose` and `onEvent` are caught so they cannot interrupt cache state transitions or prevent remaining cleanup. If `onCallbackError` is provided, Cachewise passes it the thrown value and the callback name (`dispose` or `event`). Exceptions thrown by the error handler are also swallowed; error reporting must not become another source of cache corruption. These callbacks remain synchronous, so keep them short and avoid blocking work.

## Scope

The cache is not a cross-worker or distributed coordination mechanism. Separate `Cache` instances do not share entries or in-flight computations. There is no cross-process locking or persistence.

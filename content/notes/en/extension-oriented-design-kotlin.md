---
title: Extension-Oriented Design in Kotlin
preview: "What extension-oriented design means in Kotlin: the core of a type stays small and stable, and everything else lives in extensions."
date: 2022-11-15
coverImage: "attachments/extension-oriented-design-cover.webp"
parents: ["Kotlin", "Software Design"]
---
As programming evolved, so did the ways we structure code. Early programs were simple straight-line sequences of instructions, with reuse achieved mainly through copy-and-paste. Over time, this led to the introduction of abstractions such as subroutines, procedures, and functions, and later to higher-level approaches like object-oriented programming.

Progress doesn't stop, and each language comes with its own conventions that shape how code is written and read. Today, we'll discuss Extension-Oriented Design in Kotlin — what it is, and why extensions are more than just a workaround for classes you don't own.

## Extensions in Kotlin
Let's start with a quick introduction for readers who are new to Kotlin — or don't use it daily but are still curious.

> A **Kotlin extension** is a language feature that lets you add **new behavior to an existing type without modifying it or inheriting from it**.

In most object-oriented languages, the classic way to extend functionality is through **inheritance**. This works well until you don't own the class or inheritance is not an option — for example, when a type is a primitive, `final`, `sealed`, or already has too many implementations to reasonably extend.

In Java, this limitation is usually handled by introducing so-called _helper_ or _utils_ classes (the naming varies, the idea does not). For instance, adding a function to find the maximum element in a list often looks like this:
```java
public final class ListUtils {
	private ListUtils() {}
	
	public static Integer max(List<Integer> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }

        int max = values.get(0);

        for (int i = 1; i < values.size(); i++) {
            int value = values.get(i);
            if (value > max) {
                max = value;
            }
        }

        return max;
    }
}
```

Technically, one could wrap a `List` in another class to provide additional functionality using the [delegation pattern](https://en.wikipedia.org/wiki/Delegation_pattern). In practice, this is rarely done. Imagine creating a list with `List.of(...)` and then wrapping it again in `FooList<E>` just to gain a single extra operation — this introduces unnecessary ceremony and often extra allocations for very little benefit. As a result, static utility methods remain the dominant approach. That works, but comes with trade-offs.

You must know that `ListUtils` exists, remember its name, and hope it follows a predictable naming convention. In real codebases, these classes tend to grow large, multiply over time, and fragment into several variants. Finding an existing helper function often turns into a search problem, and duplicate implementations are common simply because someone didn't know the functionality already existed.

Kotlin addresses this with **extension functions**. Instead of searching for a helper class, you look for behavior defined _on the type itself_:
```kotlin
fun Iterable<T : Comparable<T>>.max(): T { /* ... */}
```

![Code suggestions showcase](attachments/extension-oriented-design-extension-showcase.webp)

This makes discovery significantly easier. The functionality is expressed in the vocabulary of the type it belongs to, rather than being hidden behind an arbitrary utility class name.

That said, Kotlin extensions are sometimes perceived merely as a way to work around language limitations. A common example is the inability to declare a _final_ member in an `interface`, even though some functions are inherently final by nature — such as those relying on `reified` type parameters:
```kotlin
interface Serializer {
  fun <T> encode(kClass: KClass<T>, value: T): String
}

inline fun <reified T> Serializer.encode(value: T): String {
  return encode(T::class, value)
}
```

Here, the inline extension is meant to **delegate to the underlying function**, without adding new behavior. Its purpose is purely to provide a more convenient call-site usage, not to change what the original function does. Even if the language allowed overriding it, doing so would be inappropriate, because it could break this delegation and expected contract if somebody would override it in an unexpected way.

But is it only use of extensions? Not really.

## Separating Core from Capability
Now to the most interesting part — how extensions help beyond working around language restrictions? But let's start with some kind of definition:
> **Extension-Oriented Design** is an approach where a type's **core capabilities** are kept minimal and stable, while **derived, combinational, or convenience behavior** is expressed via extensions — regardless of whether the type is owned or not.

While extensions are often used for classes we don't own, ownership is not the point. The point is **separating what a type _is_ from what can be _done with it_**.

A good example is `Flow<T>` in `kotlinx.coroutines`. The `Flow` interface is intentionally minimal and is built around a **single core capability**: `collect`. Everything else is derived from it.

Conceptually, the interface boils down to:
```kotlin
public interface Flow<out T> {
    suspend fun collect(collector: FlowCollector<T>)
}
```

All higher-level operations — `map`, `filter`, `combine`, `flatMapLatest`, and many others are implemented as **extensions** that reuse this single primitive rather than expanding the interface.

For example, `map` is essentially defined as:
```kotlin
public inline fun <T, R> Flow<T>.map(
    crossinline transform: suspend (T) -> R
): Flow<R> =
    flow {
        collect { value ->
            emit(transform(value))
        }
    }
```
Extension-oriented design makes this structure explicit. The core stays small and readable; derived behavior is clearly layered on top. This, in turn, simplifies understanding the codebase and reasoning about the abstraction.

It also addresses a broader problem that abstractions often introduce: uncontrolled inheritance. When behavior is expressed through overridable members, it becomes harder to reason about what actually happens at runtime. A bug often turns into a guessing game in the code of endless chain of inheritence — what could have been overridden, and where?

Extensions avoid this class of problems by design. They cannot be overridden, and therefore cannot silently alter behavior. This is not a limitation, but an intentional property: contracts remain stable, derived behavior stays predictable, and the set of things that can influence execution is reduced.

As a result, extensions not only help structure code — they help preserve trust in the abstraction itself.

And this is not a library-only technique — you can apply the same approach in your own code. A few general guidelines:
- Define a small, stable core capability.
- Express everything else as extensions built on top of it.
- Let behavior grow without inflating the core abstraction.

In this model, extensions are not "extra helpers". They are the primary way behavior is composed, while the core remains minimal and explicit.

> If you're curious about other examples of this approach you can also go through [kotlin.Result](https://github.com/JetBrains/kotlin/blob/master/libraries/stdlib/src/kotlin/util/Result.kt#L173) and Ktor sources. In general, all Standard Library, `kotlinx.coroutines`, Ktor and other official libraries use this approach. Great source of inspiration!


## Into the Deep End
Let's try to build something ourselves to really fixate this idea. Imagine you need to build a small and simple caching library. How would you approach it with **extension-oriented design** in mind?

First, we need to identify the **core functionality** — the minimal set of operations that any cache must support. At its heart, a cache does two things:
1. Retrieve a value by a key.
2. Store a value under a key.

Everything else is just convenience layered on top. That gives us a clear, minimal interface:
```kotlin
interface Cache<K : Any, V : Any> {
    operator fun get(key: K): V?
    // Assigns [value] to a [key]. 
    // If [value] is nulls — removes it from cache
    operator fun set(key: K, value: V?): Boolean
}
```

This interface captures the **core capabilities**: `get` and `set`. It is small, stable, and predictable. Nothing else needs to live here, because everything additional can be expressed via extensions.

Next, let's think about the **consumer experience**. In real-world usage, you often want to **read a value or compute and store it if absent**. That's a very common pattern:
```kotlin
val cachedValue = if (cache[key] != null) {
    cache[key]!!
} else {
    val value = computeValue()
    cache[key] = value
    value
}
```
Writing it every time we work with cache is quite inconvenient, isn't it? We can encapsulate this pattern in a **single extension**, leaving the core interface untouched:
```kotlin
fun <K : Any, V : Any> Cache<K, V>.getOrAssign(key: K, block: () -> V): V {
    return get(key) ?: block().also { set(key, it) }
}
```

Notice how this works: the interface itself stays tiny — just `get` and `set`. Everything else lives in extensions. Here, `getOrAssign` is exactly that kind of extension: it doesn't change how the cache works, it just adds a clear, convenient way to use it.

At the call-site it reads almost like plain language: `cache.getOrAssign(key) { expensiveComputation() }`. You immediately know what's happening: if the value is there, use it; otherwise, compute it and store it. The name `getOrAssign` is chosen deliberately — we want it to be explicit about what this extension does, not leave anyone guessing.

The beauty of this approach is that we can keep the core stable while layering on behavior in ways that are predictable and composable, keeping things small, clear, and lets the functionality grow naturally.

Later on, you could add something like `invalidate(key: K)` as an extension — all without touching the original interface. It makes the API feel cleaner than relying on `set(key, null)` — which works, but feels a bit technical and not immediately obvious to someone using the cache.

## Conclusion
We use extension functions for many reasons: to work around technical limitations (for example, when a class is unavailable for modification or when certain features, such as `inline` functions, cannot be used directly), and to structure code in a way that improves understanding.

Extensions are not a silver bullet, and they shouldn't be applied mechanically. Overengineering is easy, but ignoring this approach altogether often leads to bloated abstractions and poor discoverability.

Used deliberately, extension-oriented design helps keep core abstractions small while allowing behavior to grow in a controlled and readable way.

In the end, I also highly recommend [Roman Elizarov's article](https://elizarov.medium.com/extension-oriented-design-13f4f27deaee) on the same topic.

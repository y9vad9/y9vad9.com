---
title: Failures We Don't Model Correctly
preview: "Why returning null, throwing exceptions, or wrapping everything in Result isn't just a style choice — it's a contract you define."
date: 2025-12-29
coverImage: "attachments/contract-violation-handling-cover.webp"
parents: ["Kotlin", "Software Design"]
---

Guards, validation, error handling — we all do it. We throw exceptions, return null, wrap values into Result, or trust the caller to "do the right thing". Most of the time, we don't even think about it — we follow familiar patterns and move on.

At the same time, there's a constant tension:
- "Exceptions are bad"
- "This should be exception-free"
- "We must handle all errors explicitly"

But what does that actually mean?

Not every failure is an error. Not every exception is exceptional. And not every unsafe operation deserves to be wrapped just to feel safer. What we're really dealing with is something more fundamental: violations of contracts between parts of our program.

A function assumes something about its input. A caller assumes something about the outcome. IO assumes the world behaves. Sooner or later, those assumptions break.

Kotlin gives us many ways to express that "something": throwing, returning null, exposing unsafe operations, wrapping results, or forcing callers to acknowledge failure through types. None of these are universally right or wrong — but each of them communicates responsibility in a different way.

This article isn't about banning exceptions or worshipping types. It's about understanding what contract you're defining, who owns its violation, and how explicit your API should be.

## What is a Contract?
Let's start with defining what do we mean by contract:

A **contract** is an agreement between a function and its caller that defines what inputs are allowed, what result is guaranteed if those inputs are valid, and what happens when those expectations are violated. It describes the assumptions a function makes, the promises it gives in return, and how failure is expressed when those assumptions do not hold.

We can divide contract into three main points:
1. **Preconditions**: What conditions caller must uphold before an invocation. For example, `List<E>.first()` from standard library expects you to check or be sure that `List<E>` contains at least one element.
2. **Postconditions**: What callee guarantees in return. Coming back to the previous example, `List<E>.first()` guarantees that on non-empty list it will return the first element in an array.
3. **Failure semantics**: What happens if contract is violated (function throws an exception, function returns null / type-safe result or just terminates the whole program).

Important thing to understand is that contract is not about validation like putting `require(...)` or `check(...)` in your code, rather the definition **what is allowed, what is promised, and who is to blame when it goes wrong**. You may sometimes not even have any validation (what is better to avoid; [fail-fast](https://en.wikipedia.org/wiki/Fail-fast_system) is still a thing), but it doesn't make 'contract' as a thing magically disappear.

### Types of contract violation
As this article most and foremost about handling contract violation, let's talk about different types of contract violations.

#### User Input
User input is the most obvious and most talked-about source of contract violations — and for a good reason. Users are not part of your program. They don't know your invariants, don't respect your constraints, and will happily provide input that violates every assumption your code could possibly make.

In this case, contract violations are **expected**, **frequent**, and **non-exceptional**. An empty field, an invalid email, a negative number where only positive values make sense — none of this is surprising. It's part of the normal control flow.
That's why user input is usually the place where we:
- validate eagerly,
- report errors explicitly,
- and avoid throwing whenever possible.

Here, throwing an exception often means _you lost control_. The contract was violated, but the violation was predictable, and your API should reflect that reality. Returning a typed error, a validation result, or a failure value is usually the honest thing to do.

The important part is ownership: **the caller owns the violation**. The user broke the contract, not the system.

#### Programmer Error
Programmer errors live in a different reality. These are internal mistakes (logic bugs) that usually lead to exceptions. Unlike user input, which is expected to be invalid at times, programmer errors indicate something went wrong **inside your program**, and you typically **don't handle them silently**.

Suppose you have a function that sets **the width of a view**, and it throws if the width is negative:
```kotlin
fun setWidthPx(view: View, widthPx: Int) {
    require(widthPx >= 0) { "Width must be non-negative" }
    view.layoutParams = view.layoutParams.apply { this.width = widthPx }
}
```
Now, imagine a caller that calculates a width but **forgets to handle an edge case**:
```kotlin
val parentWidth = parent.measuredWidth
val padding = 20
val desiredWidth = parentWidth - padding * 2  // oops, parentWidth is smaller than padding * 2
setWidthPx(myView, desiredWidth) // 💥 throws: Width must be non-negative
```

The function is correct, the caller is "normal", but the contract is violated. This is **a real programmer error**, and it's not something your program should try to silently recover from — except by not making such mistakes in the first place.

#### Environmental failure
Environmental failures are a completely different beast. These come from things **you don't control**, like the file system, network, or hardware. Unlike programmer errors, no amount of perfect internal logic guarantees success. Even with flawless code, these operations **can still fail** — and that's why they need explicit handling.

And even so, that **doesn't mean we should overcomplicate our code** or pretend these failures don't exist. The goal isn't to wrap everything in layers of types or defensive checks — it's to **handle the inevitable explicitly, clearly, and in the right place** with right pace.
## How to handle contract violations?
Now as we discussed types of contract violation, it's time to discuss the ways how we can at best mitigate risks that may break our code.

### How is it handled in code we use?
Let's start with examples we see on day-to-day basis.

#### Standard library
kotlin-stdlib is something many developers take inspiration from when building their own APIs. And no wonder — it introduced a set of patterns that quietly shaped how we write Kotlin today.

Let's start with functions that **throw exceptions** on contract violation:

Firstly, let's start from those that throws exceptions in case of contract violation:
- [`kotlin.Result<T>.getOrThrow()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/get-or-throw.html) throws encapsulated `Exception` in case if the result was unsuccessful. You're expected to be absolutely sure about result by checking `isSuccess()` before calling.
- [`String.toInt()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int.html) throws `NumberFormatException` in case if string wasn't a valid number. You're expected to check the string beforehand, be sure about the input or use another variant of function that we're going to discuss below.
- `Iterable<Int>.max`/`min`/`first`/`last`() that throws [`NoSuchElementException`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/collections/-no-such-element-exception/index.html) in case if given iterable didn't have any elements.

All of these APIs rely on **your knowledge of the state you pass in**. If that knowledge turns out to be wrong, they throw. Loudly and immediately.

But throwing isn't the only option. For most of these functions, the standard library also provides OrNull variants, explicitly signaling that failure is a _possible and expected outcome_:
- [`Result<T>.getOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/get-or-null.html)
- [`String.toIntOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)
- [`Iterable<Int>.maxOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-or-null.html)

Here, the contract is different: _you don't know for sure_, so the API forces you to deal with the absence of a value.

A slightly less talked-about pattern is `OrElse`, which pushes that responsibility even further to the call site:
```kotlin
val items = listOf("a", "b", "c")

val value = items.elementAtOrElse(5) { index ->
    "<missing at $index>"
}
```

Instead of throwing or returning null, the function asks you to **define the fallback explicitly**.

These three patterns — OrThrow, OrNull, and OrElse — form the backbone of the standard library's approach to contract violations. Kotlin doesn't force you into a single "correct" strategy. Instead, it gives you multiple ways to express **how confident you are**, **who owns the failure**, and **how explicit you want your API to be**. 

#### kotlinx.coroutines
`kotlinx.coroutines` are not much different and it's also no wonder – they're made by Kotlin team as well.

We can see the same patterns, as well as some other:
- [`Deferred<T>.getCompletionExceptionOrNull(): T?`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completion-exception-or-null.html) returns null if completion was not exceptional.
- [`Deferred.getCompleted()`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completed.html) throws `IllegalStateException` if `Deferred<T>` wasn't completed at the moment of call.
- [`SendChannel.trySend(value: T)`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-send-channel/try-send.html): [`ChannelResult<T>`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-channel-result/)
- [`MutableSharedFlow.trySend(value: T)`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-shared-flow/try-emit.html): [`Boolean`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-boolean/)

As we can see, there's another pattern that prepends `try` to its regular counterpart — for example, `trySend`. In `kotlinx.coroutines`, this pattern exists to turn an exception-based contract into an explicit, value-based one.

The original function signals failure by throwing. The `try*` variant preserves the same operation, but returns a meaningful result instead, allowing the caller to handle failure without relying on exceptions or try/catch.

_______
These are the main patterns you'll find across Kotlin's official libraries. The interesting part starts when you have to choose one.

That choice is rarely about personal taste or "exceptions vs types". It's about what kind of failure you're modeling, who owns it, and what the caller is expected to know or guarantee.

Is a failure part of normal control flow, or does it indicate a broken assumption?
Is the caller expected to recover, or is this a point where the program should stop pretending everything is fine?
Does this operation cross a system boundary, or does it stay entirely inside trusted code?

Answering these questions usually makes the pattern obvious: throwing, `OrNull`, `OrElse`, or `try*` stops being a stylistic choice and becomes part of the contract you're defining.

### Reality
The real question isn't which patterns exist, but where you draw the line.

In practice, most codebases don't fail everywhere equally. They fail at boundaries.

#### User Input
User input is one such boundary. We expect invalid data, so throwing is usually the wrong signal. An "exception" there doesn't communicate a bug — it just means the user typed something weird. That's why APIs at this edge naturally gravitate toward type-safe results: they make failure explicit, expected, and local.

At this boundary, we should shift our focus from exception-first to safe-first:
```kotlin
@JvmInline
value class UserName private constructor(val rawString: String) {
	companion object {
		fun create(value: String): FactoryResult {
			return if (value.length !in 2..50) FactoryResult.InvalidLength else FactoryResult.Success(UserName(value))
		}
	}
	
	sealed interface FactoryResult {
		data object InvalidLength : FactoryResult
		data class Success(val value: UserName) : FactoryResult
	}
}
```
Which.. directly contradicts our previously established pattern. But is it bad?

Patterns like throwing exception by default and then having `OrNull` or `try*` are good — _when they apply_. The Kotlin standard library is a general-purpose library and designed without our context in mind. By breaking the pattern here we risk nothing: type-system guards us.

But does this mean that all input should be treated as equally unreliable everywhere and we should discourage patterns that were previously discussed? No.

A simple counterexample is the database. When data comes from the database, invalid values usually signal a bug rather than a typical user mistake. Since it was supposed to be validated beforehand.

That's why we often introduce an unsafe variant that intentionally _bypasses_ unsafely our type-safe result:
```kotlin
@JvmInline
value class UserName private constructor(val rawString: String) {
	companion object {
		// ...
		fun createOrThrow(value: String): UserName {
			return if (value.length !in 2..50) throw IllegalArgumentException(...)
			else UserName(...)
		}
	}
	// ...
}
```

It still carries a familiar Kotlin Standard Library flavor, closely aligning with functions like `Result<T>.getOrThrow()`, which we call only when we are confident the result _must_ be successful — and anything else would indicate a bug.

We don't make `create` throw, nor try* return a type-safe variant by default — **we aren't a generic library like Kotlin Standard Library or kotlinx.coroutines** that doesn't know its target usage. We know what we expect, and in our case — every extra variant is an _extra choice_ — and by definition, every extra choice is an opportunity to misuse it. `create` is the primary function: it's what appears first in code completion, it's the first one developers reach for, and it sets the expectation of safe handling. 

#### Internal Input
Even though most of the impact on our system comes from users, it doesn't mean we need to apply safe-first patterns everywhere or blindly wrap every system call with `OrThrow`. That would be overkill.

For data whose lifecycle is **entirely owned by the system**, it's perfectly fine to throw immediately on invalid values. If a contract is violated here, it's a bug — and we want to know about it as soon as possible. We don't need extra layers of safety for something we fully control. For example:
```kotlin
@JvmInline
value class ConfirmationAttempts(val rawInt: Int) {
	init {
		require(rawInt > 0) { "Confirmation attempts cannot be negative." }
	}
}
```
`ConfirmationAttempts` it's quite logical to know that confirmation attempts cannot be negative — its contract is well-established just by naming. You _could_ technically wrap it in `createOrThrow` if you want, but I usually don't — because if every system-owned value is wrapped this way, the "attention signal" that `OrThrow` conveys gets lost — especially if everything that throws has such signal. It becomes background noise: effectively, it's the same as just putting a require in the init block, and no one notices it anymore.

This doesn't make the previously discussed patterns from standard library and `kotlinx.coroutines` obsolete. We use it for the same reason as these libraries do — when we're not sure at what boundary is it going to be used — is it a user input? Or is it a trusted boundary where mistakes are not supposed to happen? 

The principle is simple: `OrThrow` is a way to consume result unsafely, not a default for marking throwable code.

#### Uncontrolled Input
Not all data comes neatly packaged as "user input" or "system-owned". Sometimes, we deal with sources that are neither fully trusted nor entirely under our control — external APIs or third-party services. These represent a **gray area**, where contracts exist but you can't guarantee on your side that everything will go according to the plan.

We basically treat it as a user input, but as we're rarely care what exactly went wrong (except logging, but propagated exception is more than enough), I usually introduce `Result<T>` in such cases:

```kotlin
class UserProfileRepository(
    private val cache: ConcurrentHashMap<Long, UserProfile>, // should be better caching, just an example
    private val database: UserProfileDao,
    private val networkClient: UserProfileApi,
    private val logger: Logger,
) {
    suspend fun getUserProfile(userId: Long): Result<UserProfile> {
        // 1. In-memory cache is trusted system state
        val cached = cache[userId]
        if (cached != null) return Result.success(cached)

        // 2. Database I/O is an Environmental Failure boundary
        val dbEntity = suspendRunCatching { 
            database.getById(userId) 
        }.getOrElse { return Result.failure(it) }

        if (dbEntity != null) {
            // Mapping is OUTSIDE the wrapper. If this fails, it's a Programmer Error.
            // And we don't want it to be swallowed.
            val profile = dbEntity.mapToDomain() 
            cache[userId] = profile
            return Result.success(profile)
        }

        // 3. Network I/O is the most common Environmental Failure boundary
        val response = suspendRunCatching { 
            networkClient.fetchUser(userId) 
        }.getOrElse { return Result.failure(it) }

        // Again, mapping is outside to ensure we don't hide bugs
        val profile = response.mapToDomain()

        // 4. Database Write (Best-effort Side-effect)
        // Persistence is a secondary concern. We wrap and log it so 
        // that a disk/DB failure doesn't deprive the user of a 
        // successfully fetched result.
        suspendRunCatching { 
            database.insert(profile) 
        }.onFailure { throwable ->
            logger.error("Failed to persist user profile to DB", throwable)
        }
        cache[userId] = profile

        return Result.success(profile)
    }
}
```
It is crucial to notice that we don't wrap the entire function in a single `suspendRunCatching` (a custom-made alternative function to `runCatching` that doesn't swallow `CancellationException`, preventing breakage of structured concurrency). Instead, we surgically wrap only the specific I/O boundaries where failure is an environmental reality.

The mapping logic (`mapToDomain`) is intentionally left outside. We don't expect our internal mapping to fail; if it does, it is a Programmer Error, not a runtime failure. By keeping it outside the wrapper, we ensure the app crashes immediately, allowing us to catch the bug rather than silencing it inside a `Result.failure`.

In addition, you might have seen how we handled the database insertion failure. We express that this error is not that critical; we can consider it an exception that does not signal an exceptional state, rather it is a degraded state of a non-critical side-effect. Since the primary contract (delivering the user profile) has already been fulfilled by the network fetch and mapping — a failure in the persistence layer is secondary. It is a best-effort operation where the transient state of the local disk should not be allowed to break the successful delivery of the primary result to the caller.

At the end of the day, you may also introduce the same pattern we apply for user input with sealed result — it depends on how much is it important to you to handle _specifics_ of the failure. But logic of programmer errors remains.

### False Safety
#### Catch.. less

Coming back to the example from the previous section — more specifically, the database — can we really say that _every_ error thrown by an insertion or any other database operation is an environmental failure and not a programmer error?

As we established earlier with `mapToDomain`, we explicitly didn't want to wrap everything into `suspendRunCatching`. The reason is simple: we don't want to ignore errors that are not part of uncontrolled output.

A database can throw in very different scenarios:

For example, database may throw in different scenarios:
- **Environmental failures** — temporary network issues, connection pool exhaustion, database restarts, timeouts. These are rare, but they _do_ happen, and they're largely outside of your control.
- **Programmer errors caused by invalid schema or assumptions** — missing indexes, violated constraints, incompatible column types, mismatched migrations, incorrect SQL. These indicate a broken contract inside your system, not an unstable environment.

Treating both categories the same way is where false safety starts creeping in.

Yes, we want our users not to see crashes caused by things they don't control — and often things _we_ don't control either. But that doesn't mean we should silence failures blindly. Tools like detekt or ktlint warn you for a reason: being explicit about what you _intentionally_ ignore is part of writing honest code.

The question is not _"should this throw?"_, but rather _"what exactly am I willing to silence here?"_

Consider this simple function I recently implemented:
```kotlin
public suspend inline fun <reified T : Enum<T>> R2dbcTransaction.createEnumTypeIgnoring() {
    val enumName = T::class.simpleName?.lowercase() ?: error("Enum must have a name")
    val enumValues = enumValues<T>().joinToString(",") { "'${it.name}'" }

    try {
        exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
    }  catch (_: Exception) {
        // postgresql does not support CREATE TYPE IF NOT EXISTS, so we want to ignore such errors;
    }
}
```
At first glance, this looks reasonable. But what's the flaw here? 

We're catching **far too broadly**. By swallowing `Exception`, we're not just ignoring the "type already exists" case — we're also ignoring:
- SQL syntax errors
- permission issues
- broken connections
- misconfigured transactions
- or even bugs introduced by future refactoring

A first improvement might look like this:

```kotlin
try {
    exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
}  catch (e: R2dbcException) {
	// postgresql does not support CREATE TYPE IF NOT EXISTS, so we want to ignore such errors;
}
```
This is better, but still insufficient. We're now ignoring _all_ database-level failures — including ones that absolutely should surface.

We can narrow it down further:
```kotlin
try {
	exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
}  catch (e: R2dbcException) {
	// In PostgreSQL, SQLSTATE 42710 corresponds to duplicate_object.
    if (e.sqlState != "42710") {
            throw e
    }
}
```
Now the intent is explicit. We are not saying _"database errors don't matter"_. We're saying _"this very specific failure is expected and acceptable; everything else is not"_.

And it doesn't apply only to such "helper" functions — it applies everywhere.

#### Failure has destination
And while you usually don't want to leak exceptions like previously "broken connection" (especially it) outside your database layer (which is obviously might be neither ours or user's fault), this doesn't mean that every error should be caught everywhere they might occur.

Some failures are **expected to occur**, but that does not mean they should be handled everywhere they arise.  
A broken connection, a transaction failure, or a driver error are part of the environment your code runs in. They are neither programmer errors nor conditions to be silently absorbed.

These failures must be allowed to **propagate until they reach the boundary that owns the decision of what to do next**. Catching them earlier doesn't make the system safer — it only hides the fact that something went wrong and shifts responsibility to the wrong place.

And that's why, in the `createEnumTypeIgnoring` example, we _didn't_ wrap the entire function in a broad `try/catch` — on its own it means and does nothing. There, uncontrolled failures are allowed — and expected — to propagate. The function only silences the **specific, understood case** that is part of its contract (duplicate type), and lets everything else escape.

This is intentional. Error handling is not about preventing exceptions from being thrown; it's about **choosing the boundary where they should be handled**.

Catching an exception too early flattens context. Catching it too late leaks infrastructure details. The right place is usually a boundary that understands both sides: it knows _what operation was attempted_ and _what the caller can reasonably do next_.

That's also why we don't also "propagate a logger" everywhere. Logging, like error handling, belongs to a boundary that has enough context to decide whether a failure is expected noise, a degraded state, or a real bug.

In short:
- Some errors should throw.
- Some errors should travel.
- Very few errors should be caught "just in case".

The discipline is not in avoiding exceptions, but in **letting them move until they reach the boundary that can give them meaning**.

## Bonus
By the way, do you still remember [`Deferred<T>.getCompletionExceptionOrNull(): T?`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completion-exception-or-null.html)? If you assumed it _returns the completion exception or `null` otherwise_ — you were wrong. I was too. Until it **threw** an exception in real code.

Only after hitting a bug do you usually end up in the docs, where it says:
> Returns _completion exception_ result if this deferred was cancelled and has completed, `null` if it had completed normally, or throws [`IllegalStateException`](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-illegal-state-exception/index.html) if this deferred value has not completed yet.
> 
> This function is designed to be used from [`invokeOnCompletion`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/invoke-on-completion.html) handlers, when there is an absolute certainty that the value is already complete. See also [`getCompleted`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completed.html).
> 
> **Note: This is an experimental api.** This function may be removed or renamed in the future.

This isn't a misuse — it's a poorly shaped API. The name, return type, and common conventions strongly suggest a _safe query_, yet the function hides a control-flow trap behind it.

The lesson isn't "read the docs more carefully". The lesson is: **don't design APIs that violate established expectations** — especially around errors.

The lesson for the `kotlinx.coroutines` maintainers is a hard one: which is more critical — labeling a function `OrNull` just because the return type is nullable (like we wouldn't know it from compiler..?), or warning the developer of a hidden `IllegalStateException`? By focusing on the `null`, the API obscures the danger. In an honest system, it has a few options:
- it should not throw,
- `OrNull` marker should be replaced with `OrThrow`. It would make sense if it would have any counterpart
- at the very least, it shouldn't lie about its safety by having `OrNull`.

## Final thoughts
`OrThrow`, `OrElse`, and `try*` are not about how failures are produced, but about how failure states are consumed.

Each variant represents a different way for the caller to deal with a violated contract. Which one is appropriate depends on the boundary you are operating at.

For trusted boundaries — such as system-owned code or data coming from a database that was already validated — exception-first is often more than acceptable choice. At these points, failure usually indicates a bug, not a recoverable situation, and throwing communicates that clearly.

For untrusted or ambiguous boundaries — like user input or external systems we don't control — safe-first APIs are more honest. Focusing on returning a type-safe-first result makes failure explicit and forces the caller to acknowledge it where input is unexpected. Unsafe variants like `OrThrow` may still exist, but they should be secondary and intentionally opt-in.

Most importantly, `OrThrow` should not be used as a marker that "this function can throw". Its purpose is to offer an alternative way to consume a failure state, not only to annotate danger. When overused, it loses its signaling value and becomes noise.

These patterns are tools, not rules. They work best when chosen deliberately, based on the contract you are defining, the boundary you are crossing, and who owns the failure. Use them thoughtfully — not out of habit, but out of intent.

Finally, remember **the cost of false safety**: blindly silencing errors or over-protecting every operation may hide real issues. Handle failures deliberately, at the boundaries you understand, and propagate exceptions where they belong — not everywhere, not nowhere.

---
title: Semantic Typing We Ignore
preview: "Move from a “this is just a string” mentality to a “this is a concept” approach. What semantic typing is in Kotlin, when it helps a domain model, and when it gets in the way."
date: 2025-12-24
coverImage: "attachments/semantic-typing-cover.webp"
parents: ["Kotlin", "Software Design"]
---
In Kotlin, we constantly narrow our types. We prefer `String` over `Any` for text, `Int` over `Any` or even `Number` for integers. This feels obvious — almost trivial. Done, right?

So what is this article actually about?

While we subconsciously avoid `Any` in most situations — for good reasons, or sometimes simply because "why would I put `Any` here instead of `Int`?" — we often don't apply the same thinking when modeling our own software: its types, its behavior, and the relationships between them.

This article explores the practice of **semantic typing** — what it means, why you might want it, when it improves your code, and when it becomes a hindrance. We'll look at how semantic typing shows up in real Kotlin projects, both in application code and library design, and what tends to work well — or not.

Even if you're not following Domain-Driven Design, these ideas still apply. You already narrow types every day; this article is about doing it deliberately and thoughtfully.

We'll distill these lessons into practical rules to help you decide **when to narrow types semantically** — guided by reason, not intuition or habit.

## What is semantic typing?
Let's start by defining what we're actually talking about, why it matters, and why it's not something you can just ignore.

**Semantic typing** is the practice of creating semantically meaningful subsets of general-purpose types to express intent and prevent accidental misuse. It's about shifting from structural types ("this is a string") to behavioral or semantic types ("this is a email").

The idea of semantic typing isn't unique to Kotlin — it has long been a common practice in languages like Java, where developers define lightweight wrapper classes (e.g. `UserId`, `Email`) around primitives to encode domain meaning and prevent accidental misuse.

For example:
```kotlin
@JvmInline
value class EmailAddress(val raw: String) {...}
```

It's worth mentioning that semantic typing isn't limited to wrapping primitives; it applies equally to wrapping any type — whether a simple Int or a complex `Map<K, V>`. The core idea is to give semantic meaning and stronger type safety by distinguishing values beyond their raw structure.

Why should you care? This is usually where skepticism appears. Whenever this approach comes up, the reactions often sounds like this:
> What do I gain in return for this extra code? Isn't this just more boilerplate?

Those are completely valid questions — it makes you invest more time into thinking how to model your code and overall takes more time to write it. I'm all for following ideas of [KISS](https://en.wikipedia.org/wiki/KISS_principle) and avoiding wrong abstractions problem.. and now onto a big BUT! 🌚

What you get in return is actually not an abstraction for its own sake — it's clarity. Let's look at what this means in practice.

## Why?
### Compile-time safety
Let's create an example:
```kotlin
/**
 * @param value The width in density-independent pixels. 
 */
fun setWidth(value: Int) { ... }
```

At first glance, this looks fine. But it's easy to accidentally swap the measurement unit when calling it:
```kotlin
val containerSize = 1000 // random int or just raw pixels value
card.setWidth(containerSize) // dp was expected
```
Code successfully compiles and even may seem valid, but there's lying a big bug that you can't validate inside a function.

By narrowing types, we make invalid calls impossible at compile time. For example, we can introduce semantic type `Dp`
```kotlin
@JvmInline
value class Dp(public val raw: Int) {...}

/**
 * @param value The width in density-independent pixels. 
 */
fun setWidth(value: Dp) { ... }
```
Now when the `value` argument is passed, we make sure that the call-site is well-aware of measurement unit we expect.

### Documentation
I'm not the only one who's occasionally too lazy to check or write documentation, right? But don't blame me — like a wise man once said (Robert C. Martin, in Clean Code):
> The proper use of comments is to compensate for our failure to express ourself in code. Note that I used the word failure. I meant it. Comments are always failures. We must have them because we cannot always figure out how to express ourselves without them, but their use is not a cause for celebration. So when you find yourself in a position where you need to write a comment, think it through and see whether there isn't some way to turn the tables and express yourself in code.

Semantic typing doesn't just let you wrap a value in a class — it lets you **document the type itself**. You convey exactly what kind of data it expects, without repeating that information in every function that uses it. Self-documenting code, done right.

Coming back to our example:
```kotlin
/**
 * @param value The width in density-independent pixels. 
 */
fun setWidth(value: Dp) { ... }
```

You might find the documentation a little funny — as if you could just pass something else instead of `Dp`. But besides making that comment almost obsolete, we also eliminate another problem: **documentation duplication**.

Think about it: if we have `setWidth`, we probably also have `setHeight`, `setSpacing`, and similar functions. Without semantic typing, the same documentation gets copied everywhere — or worse, it's incomplete, missing or outdated entirely somewhere, because somebody was lazy or simply forgot. Then anyone reading the code has to guess the expected input based on other parts of the code they might not even be calling. With a narrowed type, that guesswork disappears — you just reuse the type where it's semantically appropriate.

But there's more. Beyond "wrapping" data, you need to consider **identity and semantics**. You're not just slapping a random name on it, like the one GitHub suggested for your repo, you're giving it real meaning. A type should stand alone, without requiring extra context, so you don't end up with something like this:

```kotlin
fun setWidth(dp: Int) { ... }
// vs
fun setWidth(dp: Size) { ... }
```
Where you're trying to express the unit of measurement through parameter naming. And documenting function instead don't do better job either. Who forces you or me to check the parameter name? What if after a long day of work I falsely assumed that it accepts raw pixels?

Even in the second example, you could still mess up the units, effectively making it another `Int`, but just wrapped and with a little less flaws (we guarded it from being just a random `Int` to a random `Size`). And the old `Int` version? Totally generic — it tells us something and nothing at the same time. semantic typing should and forces the code to **say what it means**, loud and clear. That what makes it powerful and self-documentable.

### Validation
Another benefit of introducing semantic typing — is **validation**. We're circling back to self-documentation, but this time the focus is on **reuse**.  

In our previous examples, every function had to validate density-independent pixels individually to fail fast (hopefully we were doing it, right?) and avoid hidden bugs:
```kotlin
fun setWidth(dp: Int) {
	require(dp < 0) { "dp cannot be negative" }
	// ...
}

fun setHeight(dp: Int) {
	require(dp < 0) { "dp cannot be negative" }
	// ...
}
// ...
```
Now we can move that logic into the type itself, making it a true subset type, just as we defined earlier:
```kotlin
@JvmInline
value class Dp(public val raw: Int) {
	init {
		require(dp < 0) { "dp cannot be negative" }
	}
}
```

Notice how this eliminates repeated validation, guarantees correctness everywhere, and clearly documents the intended constraints.

> **Note** <br/>
> You can, of course, introduce more robust validation to be more type-safe depending on where and how it's used; Since this article is most and foremost about Semantic Typing rather than Validation, you can read about validation separately [here](contract-violation-handling). 😄

We could have actually merged **Documentation** and **Validation** into one section — but I kept them separate deliberately. Why? Because some validation challenges are more subtle, and using a semantic type highlights them perfectly.

Take a real-world example we hinted at in the introduction:
```kotlin
@JvmInline
value class EmailAddress(val raw: String) {...}
```

Email validation has always been a headache. Different parts of a system may enforce **different rules**, often without anyone noticing. One function might just check that the string contains @. Another might use a simplified StackOverflow regex. A third might try to implement the full RFC standard.

The result? Three functions that **semantically expect the same input** may behave differently: one accepts a string, others reject it. Bugs like this are subtle, hard to catch, and annoying to debug.

By narrowing it to a semantic type, you **centralize the constraint**:
- Any `EmailAddress` instance is guaranteed to be valid according to your rules. And they remain the same.
- Consumers of the type **don't need to repeat validation**.
- The compiler enforces that only valid data flows through your system.

Validation + self-documentation + compile-time safety: this is the power of semantic typing in practice.

## When to use it?
With the examples in mind we may proceed to create a rule when we should actually use semantic typing and when most likely not.

Depending on your project or application-level code requirements, it may differ, but not too much. We definitely don't want to over-engineer!

### Application code
Let's start with what Kotlin focuses on first — application-level code. Usually, in our projects we apply architecture patterns such as Clean Architecture, Domain-Driven Design, and sometimes even Hexagonal Architecture. All of them share a common layer — the domain — which derives in some form from DDD (check my article if you're not familiar with it: [Digging Deep to Find the Right Balance Between DDD, Clean and Hexagonal Architectures](finding-balance-between-ddd-hexagonal-and-clean-architectures)).

In the context of domain layers, we typically enforce business rules, constraints, and overall core business logic, isolated from infrastructure or application concerns. Since domains are intended to reflect the language of domain experts, it's usually beneficial to introduce **semantic typing**, and more specifically, **Value Objects**.

Let's take an example — a User aggregate:
```kotlin
data class User(
	val id: Int,
	val email: String,
	val name: String,
	val bio: String,
)
```

To enforce business rules and constraints, you could go down a couple of paths. Let's start with the **opposite of semantic typing**, just to see what can go wrong:
```kotlin
data class User(
	val id: Int,
	val email: String,
	val name: String,
	val bio: String?,
) {
	init {
		require(id >= 0)
		require(email.matches(emailRegex))
		require(name.length in 2..50)
		require(bio == null || bio.length in 0..500)
	}
}
```

This is not an invalid approach, but let's reason about what can go wrong or feel suboptimal here.

**Duplication** is one obvious problem. It's common to see multiple representations of the same entity (in this case, `User`) with the same properties, which forces you to duplicate validation:
  
```kotlin
data class PublicUser(
	val id: Int,
	val name: String,
	val bio: String
) {
	init {
		require(id >= 0)
		require(name.length in 2..50)
		require(bio == null || bio.length in 0..500)
	}
}
```
Here, User contains full information for the owner, while `PublicUser` is returned to everyone else without the email. Aside from feeling unease of duplication, the rules and constraints tend to change over time, making this decentralized approach fragile and prone to being forgotten.

The solution? Introduce **Value Objects** with semantic typing. Each property becomes a type that **encodes its constraints**, centralizing validation and making your domain model self-documenting:
```kotlin
@JvmInline
value class UserId(val raw: Int) {
    init { require(raw >= 0) }
} 

@JvmInline
value class Email(val raw: String) {
    init { require(raw.matches(emailRegex)) }
}

@JvmInline
value class UserName(val raw: String) {
    init { require(raw.length in 2..50) }
}

@JvmInline
value class Bio(val raw: String?) {
    init { require(raw == null || raw.length in 0..500) }
}

data class User(
    val id: UserId,
    val email: Email,
    val name: UserName,
    val bio: Bio,
)
```

With this approach, **validation is centralized**, duplication disappears, and your domain objects become **self-explanatory and safer by design**. Each property now carries semantic meaning, and any changes to rules need to be made only in the Value Object itself, not scattered across multiple classes.

Let's also consider a more complex structure instead of just wrapping primitives. Imagine we have **two bounded contexts** (features):
- One is responsible for the **shopping cart**,
- The other is responsible for **payments**.

Both features share the same underlying data — selected products — but the **business rules differ**. For the shopping cart, it's valid to have an empty cart while the user is still selecting products. For the payment feature, however, it's crucial that the cart is **not empty** — the user must arrive with at least one selected product:
```kotlin
data class PaymentCart(
    val userId: Int,
    val products: List<Product>
) {
    init {
        require(userId >= 0)
        require(products.isNotEmpty()) // must not be empty for payment
    }
}
```

Meanwhile, you might have something like this instead:
```kotlin
@JvmInline
value class ProductSelection(val raw: List<Product>) {
	// can be something more robust with factory pattern and type-safe result for outer layer, as it's part of user input
    init { require(raw.isNotEmpty()) } // enforces non-empty list
}

data class PaymentCart(
    val userId: Int,
    val products: ProductSelection
)
```
Now, the type itself guarantees the constraint: **you cannot construct a ProductSelection with an empty list**, eliminating the risk of forgetting validation if we have, for example, more than one aggregate, like `PaymentCart` and `Bill`. 

We can also give ProductSelection additional behavior. For instance, if certain campaigns restrict delivery costs depending on the products purchased:
```kotlin
@JvmInline
value class ProductSelection(val raw: List<Product>) {
    init { require(raw.isNotEmpty()) }
    
    val specialProducts: List<Product>
        get() = raw.filter { /* some filtering logic */ }
}

data class PaymentCart(
    val userId: Int,
    val products: ProductSelection
) {
    val deliveryCosts: Money
        get() = if (products.specialProducts.size >= 3) Money.ZERO else /* normal cost */
}
```
While you could technically implement this logic inside the aggregate itself, **localizing responsibilities in the Value Object (semantic type) simplifies the code**, makes the API more explicit, and keeps the aggregate focused on core domain logic. And why should it apply only to code in the domain layer?
### Library code
Even though library code is often an additional component of any application — meaning it doesn't always follow the strict rules, conventions, or approaches typical of application code (aside from generic best practices) — I would still strongly recommend using the same approach to narrow your types almost everywhere.

Application code is usually written with the goal of minimizing upfront cost. This means that while it can be worthwhile to apply strict modeling in specific parts (like the domain layer) to reduce future testing and maintenance overhead, maintaining the same strict model everywhere often seems unnecessary or excessive. However, in my opinion, libraries don't fall under this "cost-saving" rationale.

Consider the following example:
```kotlin
@Serializable
sealed interface JsonRpcResponse<T> {
	val jsonrpc: JsonRpcVersion
	val id: JsonRpcRequestId

	data class Success<T>(
		val jsonrpc: JsonRpcVersion,
		val id: JsonRpcRequestId,
		val result: T,
	) : JsonRpcResponse<T>

	data class Error(
		val jsonrpc: JsonRpcVersion,
		val id: JsonRpcRequestId,
		val error: JsonRpcResponseError,
	)
}

@Serializable
@JvmInline
value class JsonRpcVersion(val string: String) {
	companion object {
		val V2_0 = JsonRpcVersion("2.0")
	}
}

@Serializable
@JvmInline
value class JsonRpcRequestId(val jsonElement: JsonElement) {
    init {
        require(jsonElement is JsonNull || jsonElement is JsonPrimitive) {
            "JSON-RPC ID must be a primitive or null"
        }
        
        if (jsonElement is JsonPrimitive) {
            require(jsonElement.isString || jsonElement.intOrNull != null || jsonElement.longOrNull != null || jsonElement.doubleOrNull != null) {
                "JSON-RPC ID must be a string or number"
            }
        }
    }
    
    val isString: Boolean get() = jsonElement is JsonPrimitive && jsonElement.isString
    // ... other
    val asString: String? get() = if (isString) (jsonElement as JsonPrimitive).content else null
    // ... other
}

// ... other classes in the same way
```

As we can see, we put semantic types almost everywhere! Let's reason about it:
- `JsonRpcRequestId` is associated with the one that should be presented in the initial request, meaning that it beneficiary for both library code (less error-prone due to human factor). In addition it represents a real concept derived from the specification.
- `JsonRpcVersion` is also reused, but it's not that common to be used and overall the reasoning is different — it first of all represents the concept and makes type self-explanatory by referencing to the JsonRpc Spec. The code that validate it now knows that they accept `JsonRpcVersion` and not something else.

At the end, I would say that for most cases it's most likely that you need to define semantic types to draw clear boundaries for yours and others sake, but with exceptions about which we are going to talk about later on.
### Real-world examples
Now let's hop onto real-world examples to see where we apply this technique, to reason about them and extend our context.

### Standard library
Take `Thread.sleep()`:
```kotlin
Thread.sleep(5) // five what? milliseconds? seconds? who knows
```

The **measurement unit is not explicit**. You're forced to guess and to know it, and manually convert if you:
```kotlin
Thread.sleep(5 * 60_000) // now it's five minutes, maybe
```

Some developers might wrap it in a `java.time.Duration` and convert to milliseconds in place, while others just write raw numbers and multiply it. Nothing **forces** consistency. Every developer writes what they feel is right, and the code becomes unconventional, almost random. One mistake in conversion, and the behavior silently breaks. And code complexity? It goes rough.
  
Semantic typing solves this problem elegantly. For example, with Kotlin's Duration type and well-designed API:
```kotlin
suspend fun delay(duration: Duration) {...}

suspend fun foo() {
	delay(5.minutes)
}
```
Much easier to read, isn't it?
### Android Views vs Jetpack Compose
In classic Android Views, setting sizes often looks like this:
```kotlin
val view = ImageView(context)

view.layoutParams = ViewGroup.LayoutParams(200, 300) // what are these numbers? px or dp?

view.layoutParams = ViewGroup.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    ViewGroup.LayoutParams.WRAP_CONTENT
)
```

The first problem is that, at first glance and without reading documentation, you **cannot reason about the input parameters** of `layoutParams` — is that 200 in pixels? dp? Who knows? Sure, in the Android Framework most people are aware of it, thanks to rich documentation and common ecosystem knowledge. But if you're building your own library or application, you **don't get the same safety net**. Your code probably isn't well-documented, and people rarely memorize internal details. This leads to false assumptions, subtle bugs, and frustrating debugging sessions. Also, remember what once a wise man said?

The second problem is that, just by looking at the `ImageView` class, **you have no idea that these constants exist** or that they belong specifically to `ViewGroup.LayoutParams`. Even though `ImageView` don't even extend that class, you're expected to know the "magic" behind `MATCH_PARENT` and `WRAP_CONTENT`. For any newcomer, this is a nightmare — code that's technically correct but completely opaque.

Now look at Jetpack Compose:
```kotlin
Box(
    modifier = Modifier
        .width(200.dp)
        .height(300.dp)
        .fillMaxWidth()
) {...}
```
Compose solves the same problem through **semantic typing**:
- `Dp` wraps raw numbers, preventing accidental misuse.
- Intrinsic sizes like `fillMaxWidth()` are **typed functions**, not magic numbers.
- The compiler enforces correctness — no more guessing about units or constants.

The difference is striking: Compose **pushes correctness into the type system**, making code **self-documenting, safer, and easier to reason about**, while classic Views rely on conventions and mental checks.

This is a perfect real-world illustration of why **semantic typing matters**: it reduces mental overhead, prevents misuse, and communicates intent directly through the types.

## When not to use it?

Think of semantic typing in context of value objects from DDD – as first and foremost real-world concepts. In most cases — whether you're building an application or a library — the types you define should represent things that exist or make sense **in the world your software models**. Most values we work with _do_ correspond to such real-life concepts. However, it's easy to get carried away and start modeling _rules_ instead of _ideas_ — which leads to types that clutter your codebase rather than clarify it.

### Modeling inputs

Let's start with something simple.

Take `PositiveNumber`. At first glance, it might seem useful: it enforces a constraint and could be reused in many places. But **is it a concept?** Not really.

You may say:

> **But why bother? Didn't you say that it's an advantage of semantic typing — that I can centralize validation? Isn't that exactly what variable names are for? If I name it `price: PositiveNumber` or `distance: PositiveNumber`, doesn't that clarify everything?** 

It might — **for a moment.** But naming alone isn't enough in practice:

- **Naming doesn't travel.** Once the value leaves the scope where it was created, the meaning is often lost. You can't rely on every developer — across every file, layer, or feature — to maintain that clarity.
- **People reuse types for convenience.** If `PositiveNumber` works, someone will use it for price, distance, item count, or whatever else they find that fits. And once a type is reused generically, its original intent disappears. You don't want to create such a "generic" trend, otherwise what's the point of introducing a semantic type? 
- **Reviews and onboarding suffer.** When the same type is used for many things, it gets harder to reason about code, harder to trace bugs, and harder for newcomers to understand what a value _actually_ represents.
- **Bugs creep in silently.** You might never notice that someone accidentally passed a "length in kilometers" where "price in euros" was expected — because the type `PositiveNumber` accepts both.

So the problem isn't that names are bad — it's that **they're too easy to misunderstand, too easy to misuse, and too easy to forget.** If something _means_ price, make it a `Price`. That meaning should survive refactors, boundaries, and time. Thus, the simplest reason to avoid it, is because **it's too genetic**. In reality, **Validation** is just a handy outcome and not the reason to introduce semantic typing.

You may take a natural language as a reference and think whether you would express your thoughts to a stranger in the way how you phrase your semantic type. But, honestly, because it's too subjective, for me it was not a fit for a rule.

Therefore we can come up with more intuitive and more explicit rule:

> **Type constraints should not drive your semantic type in any sense – in naming or in existence.**

**But what if `PositiveNumber` was in mathematical context?**

It may seem that `PositiveNumber` **can still help** with preventing mistakes in our code, for example in context of mathematic operation that uses division:

```kotlin
fun sqrt(x: PositiveNumber): Double
```

At first glance, this looks neat — you're encoding the domain rule "no negatives allowed" right into the type in the context that "allow" such concept.

But is it a valid concept within such domain? I would maybe say "yes", but would most definitely avoid it subconsciously. Why?

**The meaning in such case depends on the operation, not the input**. Take this:

```kotlin
fun sqrt(x: PositiveNumber): Foo
```

The **operation** (sqrt) is what _defines_ the constraint — that the input must be non-negative. The input itself, as a number, **does not inherently carry that meaning**. **Without the operation context**, the `PositiveNumber` type **is just a number with a constraint** — but what does it _really_ mean on its own?

On top of that, many people casually associate "positive number" with "non-negative", forgetting that zero is **not** positive nor negative, nor both at the same time. This subtle confusion can lead to seemingly logical code that is actually incorrect. Conceptually, look at these two operations:

```kotlin
@JvmInline
value class PositiveNumber(val value: Double) {
    init {
        require(value > 0) { "Value must be strictly positive" }
    }
}

fun sqrt(x: PositiveNumber): Foo
fun ln(x: PositiveNumber): Foo
```

Now imagine trying to call these functions:
```kotlin
val zero = PositiveNumber(0.0) // ❌ throws IllegalArgumentException
sqrt(zero) // ❌ fails, but mathematically sqrt(0) is valid
ln(PositiveNumber(1.0)) // ✅ works
```
Both functions appear to operate on "positive numbers", but the precise constraints differ: `sqrt` accepts zero (non-negative), whereas ln requires strictly positive values. If you try to reuse a single `PositiveNumber` type for both, one of the operations will either reject valid input or allow invalid input. **Semantic typing must respect the operation context**, not just the nominal value.

While the example is really specific, it should give you a great example of possible problems of misusing too general types, making it a reason not to introduce them.

And original problem? You've pushed the constraint to the input, but in practice, it's the _operation_ that defines the constraint. You could instead say:

```kotlin
fun sqrt(a: Double): Double {
	// it would also be more than okay to have here just a guard
	require(a >= 0)
	// ...
}
fun sqrtOrNull(a: Double): Double? {
	if (a > 0) {...}
	return null
}

fun ln(a: Double): Double {
	require(a > 0)
	// ...
}
fun lnOrNull(a: Double): Double? {
	if (a > 0) {...}
	return null
}
```

Prefer duplication over a wrong abstraction for cases where you can't come up with a real-world concept.

Thus I would make even more explicit rule:

> **Operation constraints should not drive your semantic type in any sense – in naming or in existence.** If you can't come up with reasonable name without mentioning constraint that would fit this rule – you most definitely don't need a "semantic type".

Another thing to mention is that we may, for example, have a `Dp` class that represents density-independent pixels and still have restrictions defined by operation (usage context):
```kotlin
fun setDividerHeight(value: Dp) {
	require(value != Dp.ZERO)
	// ...
}
```
Introducing some kind of `DividerHeightDp` with such condition is overkill and basically falls under `PositiveNumber` problem.

But you may say:

> But what if we allow `PositiveNumber` just because it enforces a helpful constraint and I don't have any ambiguity in my code for it?

And that's maybe great! But in reality where do we draw the line?

Why stop there?

- Why not also have `NegativeNumber`?
- `NonZeroNumber`?
- `NonEmptyList`, `OneElementList`, `AtLeastThreeItemsList`?
- `ShortString`, `UppercaseString`?

I am absolutely sure that at least some of given options you would not like to see in your code, but without a clear rule it's easy to fall to some extent for that.

And once you go down this path, **any rule becomes a candidate for a semantic type** — and that's the problem. You're no longer modeling _concepts_ — you're modeling _conditions_. And conditions are not identities.

At that point, you're not designing a rich domain model. You're building a constraint-validation library shaped like your domain. And that's a completely different goal — one that introduces more complexity than clarity.

Thus, let's come up with the reasonable rule without relying on any of ours "internal feelings":

> **If the semantic type cannot stand alone as a meaningful concept without its underlying type, it is likely a bad semantic type.**

That's also why introducing `DividerHeight(value: Dp)` instead of `DividerHeightDp(value: Int)` – is a bad idea. It will just be unwrapped every time, creating a lot of unnecessary boilerplate in our code.

### Modeling outputs

We've spent enough time talking about semantic typing for **inputs** — types that wrap data _going into_ our domain. But what about the **opposite direction**? Can semantic types also be useful for modeling **outputs**?

Let's consider the following example:

```kotlin
val textContents: FileTextContents
```

Why it's bad? First of all it tells the source! But wait.. why is this a problem?

Let's add similar variants to understand this problem more:

- `FileTextContents`
- `HttpTextContents`
- `UserInputTextContents`
- ..where do we stop?

It's perfectly fine to have the following:

```kotlin
@JvmInline
value class FileSize(private val bytesAmount: Long) {
	val bytes: Long get() = bytesAmount
	val kilobytes: Long get() = ...
	// ...
}

class File (...) {
	// ...

	val size: FileSize get() = ...

	// ...
}
```

This example isn't really about telling the source of data, but rather about a functional concept in its own right — **file size**. The idea of FileSize **represents an actual concept**: an amount of bytes named according to our domain. Whether it came from a file, a memory buffer, or a network stream — its _meaning_ remains the same. FileSize reflects a concept that stands on its own. 

Thus, naming it like `DownloadedFileSize` makes no sense. Ask yourself:

> Does the _source_ of this string truly matter to the business logic?

Introducing something like this might feel "descriptive", but in reality, you're hardwiring context that doesn't belong to the core concept. You're taking a neutral, reusable concept — like "text" or "size" — and narrowing its scope unnecessarily. This creates fragmentation, confusion, and needless ceremony in the API of converting one into another for no reason. And I have a feeling that we don't like mapping one into another 🌚

> **Name your concept narrowly enough to be understood at a glance, but without exaggeration.**

## Conclusion
Semantic typing, and value objects in particular, are powerful tools for pushing intent, validation and domain meaning into types. Use them when a concept is part of your domain language, when invariants must be centralized, or when an API boundary needs clearer intent. Avoid them when the constraint is defined by an operation rather than the concept itself, or when a type would be overly generic and thus lose meaning. Establish simple team rules so the benefits scale without creating unnecessary ceremony.

---
title: Package Naming Nobody Cares About (But Should)
preview: "Packages work better as namespaces than as folders — the rules I use to decide what deserves its own package and what doesn't."
date: 2025-10-15
coverImage: "attachments/package-naming-problem-cover.webp"
parents: ["Kotlin", "Software Design"]
---
Package naming and organization are fundamental aspects of writing maintainable code. How we choose to group files and modules impacts not only readability but also the ease of navigation and future development.

In this article, we'll briefly explore how packages are used, trying to create some rules and give some reasoning about when it's a bad idea to create a separate package and when it's not.

> Article was originally published on dev.to — https://dev.to/y9vad9/package-naming-nobody-cares-about-but-should-3i5

## What is a Package, Really?

A package is one of the first concepts you encounter right after writing your basic "Hello World" program in Java or Kotlin. The simplest and yet misleading way to describe it is just as a folder structure used to organize code and prevent naming conflicts.

And while it's partially true, it might give you the wrong perspective on when to actually use it. But let's stick to some kind of definition:

> **Package name** in Kotlin and Java is a **namespace** used to organize a set of related types (classes, interfaces, enums, etc.) into a cohesive unit. It serves a dual purpose: providing logical structure to a codebase and preventing naming conflicts in large-scale applications or when integrating third-party libraries.

Taking into account our previous "simple" explanation, it's true that packages help us avoid naming conflicts, since it's rare for class names to be 100% unique. 

## Packages as Folders

Despite the benefits that packages provide, there's a significant downside: due to how packages are implemented in Java and Kotlin — and how IDEs handle them — they don't fully serve as true namespaces, even though they ideally should. For this reason, we tend to name our classes in a way that is expressive enough on its own, without needing to rely on the package name. For example:  
- `UserAnalyticsReport`  
- `OrderRepository`  
- `UserFileStorageService`

Even though these classes may be placed in distinct logical packages, like:  
- `com.example.user.UserAnalyticsReport`  
- `com.example.order.OrderRepository`  
- `com.example.user.UserFileStorageService`

which theoretically could provide differentiation if we could write something like:  
```kotlin  
import com.example.user

val report = user::AnalyticsReport(...)  
```

Unfortunately (and fortunately), we're not in C++ (which isn't necessarily a good or a bad thing). Since most people rely on IDEs' auto-importing and auto-completion features, they rarely deal directly with packages and therefore often don't put much thought into package structure.

This approach can lead to a flawed mindset when designing your own package structure — you start thinking in terms of grouping files rather than defining meaningful namespaces and boundaries, leading to unclear responsibilities. The result is often a directory full of classes, organized by location rather than purpose.

Even though it makes you feel good about things being "organized", it usually leads to a lot of problems. This is the wrong mental model.

## Packages as Namespaces

A better mental model is to think of packages as **semantic boundaries** — they tell you what part of the system you're looking at and, ideally, what that code is responsible for.

But let's be honest: most people treat packages as mere folders, often because they're intimidated by the number of files within a package. This "drawer" mentality keeps us from thinking deeper about **why** we group code the way we do. I struggled with this mindset myself for a long time.

When you start treating packages as true namespaces, several beneficial things happen:  
- **The package itself becomes part of the documentation** — just by looking at where a class lives, you get a sense of what it does and what it's responsible for.  
- **Related functionality naturally stays together**, while unrelated code stays apart. It also makes you think more about "what is it responsible for?"/"Who is the owner of this particular class/function"?

Beyond that, many common software design headaches simply vanish. One of the biggest culprits in large codebases is the overuse or misapplication of generic "category" packages, such as `model`, `dto`, or `entity`.

For example, consider a large project where multiple teams work on user-related features. You might see packages like:

```  
com.example.user.model.profile  
com.example.user.profile.model  
com.example.user.utils.profile  
com.example.user.profile.utils  
com.example.user.dto.profile  
com.example.user.profile.dto  
```  
*(It's even more feasible in multi-modular projects, especially when multiple teams involved)!*

Here, the "profile" concept is scattered across multiple packages and subpackages, often with duplicated or reversed naming orders. Sometimes "profile" isn't even a standalone domain concept but just a part of the user aggregate — yet it's treated as its own package to reduce the number of files in `user.model`. Teams unintentionally recreate the same logical groupings multiple times because they don't realize an equivalent package already exists somewhere else. This often results in inconsistent package naming based on personal preference rather than clear conventions, which makes onboarding new team members more difficult and slows down the process. Never to be asked again, "Why is it not here, but here?".

While this example is simplified, you will inevitably encounter this issue in real projects — especially if you maintain a library where backward compatibility across versions is critical. In such cases, inconsistent or unclear package structures can introduce long-term maintenance headaches and increase the risk of breaking changes.

This situation quickly devolves into a maze where:  
- You spend more time guessing where something might live rather than understanding what it does.  
- Terminology becomes inconsistent across teams — some call certain classes "models", others call the same or similar concepts "entities" or "DTOs".  
- You get tangled in redundant or conflicting packages like `user.utils.profile` vs `user.profile.utils`, with no clear ownership or responsibility.

In such cases, generic package names like `utils`, `model`, or `dto` become meaningless labels. Instead of helping you find code based on its responsibility, they force you to rely purely on terminology — and since different people or teams often use these terms differently, this vocabulary can change or conflict over time. This makes understanding the codebase more dependent on mastering a shifting and ambiguous glossary rather than on intuitive architectural boundaries.

By contrast, when packages represent **responsibility** rather than just file categories or vague groupings, the codebase becomes more navigable, easier to understand, and more resilient to team or terminology changes.

### What deserves a namespace?  
While it's relatively easy to reason about not creating a `.model`, `.util`, `.impl`, and so on, there is a big elephant in the room that remains unanswered — how to determine what deserves and what does not deserve a namespace?

Let's create an example:  
```  
com.example.user  
 ├─ User.kt  
 ├─ UserId.kt  
 ├─ UserFactory.kt  
 ├─ settings  
 │   ├─ UserSettings.kt  
 │   ├─ NotificationPreferences.kt  
 │   └─ PrivacyOptions.kt  
 ├─ profile  
 │   ├─ UserProfile.kt  
 │   ├─ ProfilePicture.kt  
 │   └─ Bio.kt  
 ├─ security  
 │   ├─ Password.kt  
 │   ├─ SecurityQuestions.kt  
 │   └─ TwoFactorAuth.kt  
 └─ utils  
     ├─ UserValidators.kt  
     └─ UserMappers.kt  
```

> For the sake of simplicity, we will avoid mentioning any layering in our structure.

While collapsing all folders might make the structure look clean and minimal, it often turns into a long, meandering chain of subpackages with no clear purpose. Take `profile` for example — it may appear as a cohesive, independent unit, but we should pause and ask ourselves:  
- Does `.profile` make any sense without a user concept?  
- Does the actual usage of entities within `.profile` make sense outside the `user` package (for example, is it only wrapped inside another class and managed by)? _(mappers don't count 😁)_  
- Does this package provide a meaningful black box with its own API, used by more than just user? Or is it something that only makes sense inside User — for example, a UserProfile that never exists independently, is always unwrapped from User, and cannot be accessed without it?
- If I have to change something in this group of classes, will I usually change the others too?

**If any of the answers are yes** → they most likely belong together in the same package.  
**If all are no** → maybe it deserves its own package.

#### `.common` / `.core` packages
Another edge case that I think is worth mentioning is the `.common` / `.core` packages, which I personally see frequently in codebases. While they seem handy at first, for the most part, their underlying meaning is literally "this is stuff that doesn't fit anywhere else". Thus does not really represent a **cohesive concept** or a **clear boundary**. 

The question is simple — why introduce `com.example.common` if it should either be localized to the meaningful place or just be put inside `com.example`? It's another example of "drawer" mentality, resulting in the situation where, over time, every team member will toss unrelated code there without any thought. And soon the package becomes a grab-bag of everything and nothing at the same time.

As more and more unrelated code gets dumped there, it turns into the most depended-on part of the system, creating hidden coupling everywhere. That in turn makes refactoring dangerous, since moving anything out feels risky when you're unsure who relies on it. Over time, the result is architectural erosion: instead of well-defined boundaries, the system gravitates around a bloated God-package at its center.

#### Bonus way of thinking

As an additional way of thinking about it, you can consider an "Aggregate" from DDD as a mental model for identifying a coherent concept that deserves its own namespace. The idea is that a package should represent something that has meaning and utility on its own to the outside world.

Value objects, domain entities, and events often don't qualify for separate packages because they exist solely to support the aggregate — they have no independent meaning outside of it. Splitting them into their own packages would violate the principle of exposing a clear API to the outside and would create artificial boundaries where nothing makes sense in isolation.

Everything inside the aggregate is highly coupled, and that coupling is exactly why it belongs together in the same package: it communicates that these elements only have significance in the context of the aggregate.

This approach ensures packages remain meaningful units of organization, rather than arbitrary folders that obscure the system's true structure. 

## Namespacing on macro level
Until now, we've focused on packages at the micro level, like inside a domain. But what about **layers themselves** — `domain`, `infrastructure`, `presentation`?

On this level, packages signal **architectural boundaries** and obviously brings a lot of benefits. `domain` holds core business logic, `presentation` deals with APIs or UI, and `infrastructure` wraps technical details like databases or messaging. Importantly, even, for example, infrastructure often contains **self-sufficient logic and types** to access its logic (ideally), making it a cohesive unit in its own right. The key is that each layer still groups meaningful units rather than acting as a dumping ground. Done right, macro-level namespaces give developers a **quick mental map** of the system and make dependencies on layers explicit.

Thus, we can see it as a positive thing rather than a meaningless technical label — these boundaries are, for the most part, self-sufficient.

## Naming a namespace (package)
Now that we've covered when to create a package, let's talk about **how to name it**. A package should be named after the **concept it represents**, not the number of things inside it.

For example, if your code is built around managing a single `Order` — its validation, lifecycle, and operations — naming the package `orders` is misleading. Plural implies a collection, which doesn't reflect the fact that the package is about the **Order concept** itself. The correct choice is `order`, which communicates that this namespace is about the domain concept, not a list of orders.

Similarly, don't name packages `errors`, `events`, or `notifications` just because they contain multiple items of that type. The question to ask is: what **concept or responsibility** does this package capture? Name it after that concept, not the quantity of instances it holds. This keeps your package names **precise, meaningful, and aligned with the mental model of your system**.

Can a package name ever be plural? Sure. But in practice, it's far less common than people assume. Most of the time, the package represents a single concept, not a collection, so as a default, we go with singular.

## Make the correct focus
It's not enough to just create meaningful namespaces — the _focus_ of those namespaces matters just as much.

Consider two structures:
```
com.example.domain   
 └─ user  
     └─ User.kt   
```

vs:
```
com.example.user   
 └─ domain  
     └─ User.kt   
```

Both look valid, but they communicate very different priorities. The first (`com.example.domain.user`) puts the technical layer first and center. The second (`com.example.user.domain`) keeps the spotlight on the concept — `user` — with the layer being secondary.

This difference becomes important as the system grows. Not every concept or feature will even have a `.domain`, or a `.presentation` (for example, authorization most likely does not have a business logic, therefore, does not deserve a `.domain`), or whatever layer you expect. That means navigation quickly becomes awkward: you can't tell what a feature _does_ or _contains_, only that it might sit somewhere under a technical label. The result is uneven hierarchies and folders that feel bloated with layers, while the actual business concepts get buried.

Modules show the same pattern. At a small scale, having `:domain:user` and `:domain:task` might look fine. But once you add `:application:auth`, `:application:user`, `:application:task` (while `:domain:auth` doesn't exist) navigation becomes strange. You can't immediately tell the actual capability of a feature or bounded context: does `auth` even have domain logic, or is it just application code? The structure pushes technical boundaries first, while leaving the conceptual boundaries unclear.

A concept-first approach — `com.example.user.domain`, `com.example.order.infrastructure` — avoids this problem. You always start with the thing the business cares about, and only then refine by the layer. 

Does it have a `domain` or `infrastructure` layer? That doesn't matter — what matters is the concept itself, and only then how it's implemented internally. **This is especially important because the structure is likely to change over time.** And what do you do then?
## Conclusion  
Let's summarise the main points, starting with the micro level:  
- First of all, my recommendation would be not to go by 'when not to create a package' path, but by 'when to create', meaning that we don't create a separate package by default. Unless we have a strong reason. 
- It's justified to have a separate package if we want isolation, for example, when we talk about layered software design. It's also justified when the package is actually an independent cohesive unit that has an independent meaning. 
- We definitely don't create packages like `utils`/`ext(ensions)`/`helpers`/ `impl` and alike. 
- We don't create packages that do not represent themselves in the general context.

At the macro level, it's perfectly fine to have packages like `domain` or `infrastructure` that reflect the architectural layer you're working in. In addition, set your priorities correctly — concept is first, then a layer you're operating on.

Finally, **use singular names by default**, unless the concept itself is inherently plural, like `news`.

Here is example of the structure just for your reference:
```
com.example
 ├─ user
 │   ├─ domain
 │   │   ├─ User.kt
 │   │   ├─ UserId.kt
 │   │   └─ UserName.kt
 │   ├─ application
 │   │   ├─ UserService.kt / SomeUseCase.kt
 │   │   └─ UserRepository.kt
 │   └─ infrastructure
 │       ├─ database
 │       │   └─ UserDataSource.kt
 │       └─ adapter
 │           └─ UserRepositoryImpl.kt
 │       └─ messaging
 │           └─ UserEventsPublisher.kt
 ├─ order
 │   ├─ domain
 │   └─ ...
```

Overall, you may apply these rules to other languages outside JVM-ecosystem, such as TypeScript with its modules systems or anything else that has namespacing as a concept.

___________

More than 5 files within a directory ain't that scary, fellas!  

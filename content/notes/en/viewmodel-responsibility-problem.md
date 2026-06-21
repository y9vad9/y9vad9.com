---
title: ViewModel is not a place for your logic
preview: "Are your ViewModels doing too much? We explore the proper boundaries of ViewModel responsibility and why keeping them focused on UI state is key to a healthy, scalable software design."
parents: ["Android", "Kotlin", "Software Design"]
date: 2023-02-20
---
One of the most common mistakes I see in Android development is **overburdened ViewModels**.

A ViewModel is — and should remain — **a holder of UI state, nothing more**. Its responsibility is to expose state and transform it. Anything unrelated to state, such as navigation or I/O, does not belong there.

## Why no navigation?

Consider an app originally designed for phones only. Navigation is simple: you pass a navigator and push screens onto a stack. Now imagine adapting the same app for tablets or desktops.

Suddenly, navigation is no longer a linear stack. A screen might need to appear alongside another, in a pane, or in a completely different layout. If navigation logic lives inside the ViewModel, you're stuck rewriting or branching that logic per form factor.

Even if we ignore the Single Responsibility Principle, embedding navigation into ViewModels tightly couples them to a specific UI structure — and that does not scale beyond a single screen size.

## Why no I/O operations?

A ViewModel performing low-level I/O is a direct hit to testability and maintainability. These concerns belong to the data layer.

Once I/O sneaks into a ViewModel, tests start to blur responsibilities.

UI logic, business logic, and data access are tested together — or not tested at all. This is where [`@VisibleForTesting`](https://developer.android.com/reference/androidx/annotation/VisibleForTesting), reflection hacks, or simply missing tests tend to appear.

At that point, the ViewModel is no longer a predictable state container, but an implicit orchestrator of everything — untouchable, like the main character in a movie.

### The rule of thumb
- **UI**: handles navigation and reacts to user interactions
- **ViewModel**: holds and transforms state
- **Data / Application / Domain layers**: handle I/O and business rules

That's it. Keep ViewModels boring — and your architecture stays flexible.

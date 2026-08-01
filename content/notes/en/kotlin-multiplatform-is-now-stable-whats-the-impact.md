---
title: Kotlin Multiplatform is now stable – What's the Impact?
preview: "Kotlin Multiplatform went stable in 1.9.20 — what that changes for developers and teams, and which parts are still experimental."
date: 2023-06-16
coverImage: "attachments/kmp-stability-cover.webp"
parents: ["Kotlin"]
---
In the latest Kotlin release, [version 1.9.20](https://blog.jetbrains.com/kotlin/2023/11/kotlin-1-9-20-released/), a significant milestone has been achieved with the stabilization of Kotlin Multiplatform technology. This marks a pivotal moment in Kotlin's development, as Multiplatform support has transitioned from its beta phase, which began in [version 1.7.20](https://kotlinlang.org/docs/whatsnew1720.html), to a stable and reliable feature in the Kotlin ecosystem.

For those who doesn't know what is Kotlin Multiplatform, I will explain it in brief:
> **❓ Explanation** <br/>
> Kotlin Multiplatform – is Kotlin technologies that leverages language ability to be compiled in different environments and languages, such as JVM (+Android), Web (via JavaScript or WebAssembly; in addition WASM can be used for other targets within its technology) and Native (iOS through Objective-C and Desktop using C++). Using it, you can write common and reusable code between different platforms only using Kotlin.

## Game changer
Now that it's stable, let's highlight its advantages:
- **Easier to sell**: When technology reaches such state, it's much easier to push it towards your managers and overall business to use this technology that was not that reliable before.
- **Stable API**: Stable APIs guarantee consistent performance, easing developers' concerns about future compatibility and making it an appealing option for long-term projects.
	- **Library Reliability:** Library authors benefit from stable Kotlin Multiplatform, ensuring their creations remain compatible and trustworthy, encouraging wider adoption.
	- **Effortless Upgrades:** Smooth transitions between versions simplify the update process, providing businesses and developers a hassle-free experience.


Moreover, the stabilization of Kotlin Multiplatform opens up new opportunities for collaboration and innovation within the Kotlin community. With a stable foundation in place, developers can explore creative solutions and build versatile applications that cater to a wider audience. This shift from beta to stable empowers developers to pursue ambitious projects, knowing they have a reliable framework to support their endeavors.

> **📝 Note**<br/>
> It's important to clarify that while Kotlin Multiplatform has reached overall stability, this doesn't necessarily extend to specific targets. For instance, the WebAssembly (WASM) target remains experimental, and some native targets might still be in the experimental phase. This means developers should exercise caution and check the stability status of individual targets before incorporating them into their projects. But for those that is using it for Android / iOS / Desktop **it's already stable**.

### My opinion
I've been using this technology for 1.5 years, and the shift towards stability in Kotlin Multiplatform brings a sense of optimism about Kotlin's future. However, it's important to note that while the overall framework is stable, specific technologies like Compose/Multiplatform might not be production-ready yet. For instance, Compose's web and iOS targets are still experimental.

However, for tasks that don't involve building common UI components, Kotlin Multiplatform is highly valuable. One of the most notable use cases is, for example, in network communication. Developers can create shared networking code using Kotlin Multiplatform, which can be utilized across platforms, both in Kotlin and native languages specific to each platform. This versatility makes it a powerful tool for enhancing productivity and code reusability in multi-platform projects.

## Conclusion
In summary, the stable release of Kotlin Multiplatform in version 1.9.20 signifies a pivotal moment in the evolution of Kotlin. Developers can now harness the power of Kotlin Multiplatform with confidence, knowing that it offers a reliable and efficient way to create cross-platform applications. This development not only simplifies the development process but also fosters a collaborative and innovative environment within the Kotlin community, paving the way for a future of diverse and dynamic cross-platform applications.
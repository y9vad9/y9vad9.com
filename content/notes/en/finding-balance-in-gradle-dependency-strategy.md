---
title: Finding the Right Balance in Gradle Dependency Strategy
preview: "Mastering Gradle dependency management is crucial for software engineering. This article explores various strategies for declaring dependencies, plugins, and versions, discussing their merits and pitfalls. It covers topics like updating dependencies, security vulnerabilities, and centralization, and introduces solutions such as properties, constants, version catalogs, and BOMs to achieve simple, secure, and maintainable build configurations."
date: 2023-11-25
coverImage: "attachments/finding-balance-in-gradle-dependency-strategy-cover.webp"
parents: ["Gradle"]
---
# Introduction
In the dynamic field of software engineering, mastering dependency management is essential. With Gradle, developers have numerous strategies to declare dependencies, plugins, and versions. We will explore these methods and dissect the reasons for choosing each approach, delving into their merits and pitfalls.

> 🎉 Yay! This article was included in [Gradle Newsletter for February 2024](https://newsletter.gradle.org/2024/02).

> It was originally published on dev.to — https://dev.to/y9vad9/finding-the-right-balance-in-gradle-dependency-strategy-4jdl

## Why?
Before diving into methods, understanding the significance of well-structured dependencies is crucial. What potential issues can arise in the future, and what problems should proper structuring solve? Let's explore.

### Updating your dependencies
In multi-module projects, updating dependencies like Kotlin versions or library versions can quickly become a daunting task. Imagine having to navigate through every `build.gradle.kts` file, locating the plugins block, and modifying the version function for each dependency or plugin. The real challenge emerges when you're dealing with a significant number of modules. It's incredibly easy to overlook a specific dependency, leading to version conflicts or, in cases like Jetpack Compose, running into issues with unstable APIs tightly bound to specific Kotlin compiler versions (that can easily make your build broken with unexpected errors). You don't want to run into hours of debugging, because of simple mistakes, am I right?

### Security vulnerabilities
In the realm of software security, vulnerabilities in your code can pose significant risks. Many vulnerability scanners, however, struggle with dependencies that are partially defined in other files than `build.gradle.kts` (for example, versions in `properties` files). It's crucial to adopt practices that align with security systems, ensuring your code remains robust and safe.

### Lack of Centralization
In smaller projects, managing dependencies manually might seem feasible. However, as the project and team expand, this approach quickly becomes a challenge. It's far more efficient to spot issues within a specific file(s) rather than sifting through numerous configuration files, attempting to identify potential problems.

Centralizing dependency management enhances documentation. It allows specific decisions, like version choices, to be documented clearly. This centralized approach simplifies leaving notes or todos for reviews or impacting dependencies. Consistent formatting minimizes confusion and enhances readability, fostering a shared understanding of the project's dependencies. This creates a more efficient collaborative environment for the team.

Lastly, a centralized approach offers consistency in the definition style. When everyone adheres to a standardized format and structure, it minimizes confusion and enhances readability. It fosters a cohesive understanding of the project's dependencies, making collaboration smoother and more effective.

_________
Overall, declaring your methods centralized makes your build configuration more clean, understandable and maintainable by newcomers.
## Solutions
Now, we've already discussed possible problems, so let's define our main goals:
- Simple
- Secure
- Maintainable

Now, we will come up with the solutions discussing their problems and advantages. Let's start from the simplest.

### Properties as versions container
In the ever-evolving landscape of Gradle build management, the use of `.properties` files as version containers remains a prevalent approach. This method centralizes dependency versions, ensuring project-wide consistency.

For example, you can add your versions to `gradle.properties`:
```properties
kotlinVersion=1.9.20-RC
coroutinesVersion=1.7.3
```

And access it in your `build.gradle.kts`:
```kotlin
// ... plugins, repositories

val coroutinesVersion by project // it will auto-resolve property by name

dependencies {
	implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
}
```

But, it has obvious disadvantages:
- **Lack of plugins support**: As `plugins` evaluates before any other code in the `build.gradle.kts` and has restrictions on operations inside, you can't use properties to provide versions to your build.
- **Boilerplate**: It adds a lot of boilerplate code (if we have more than one dependency that is obviously always a case) that clutters other logic and makes it less maintainable and understandable.

One of the advantages is that you can override properties on the Gradle Build stage, but you'll probably never need it.

In some cases, you can combine such an approach with another if you really need it, but for most projects, it's a bad idea.

### Dependencies as constants
As Gradle supports [composite builds](https://docs.gradle.org/current/userguide/composite_builds.html) and [`buildSrc`]() convention module (note: it's also treated as composite built, but implicitly), you can simply create using Kotlin / Java / Groovy language singleton with constants that have dependencies & versions definition and use it directly in your builds in the next way:
```kotlin
object Deps {
	object Libs {
		object Kotlinx {
			const val Coroutines = "org.jetbrains.kotlinx:kotlinx-coroutines-core:${Versions.coroutines}"
		}
	}

	object Versions {
		const val kotlin = "1.9.20-RC"
		const val coroutines = "1.7.3"
	}

	object Plugins {
		object Kotlin {
			// let's take jvm plugin just for example
			const val Id = "org.jetbrains.kotlin.jvm"
		}
	}
}
```
In the case of `buildSrc` it's always in your Gradle Build configurations classpath (context) and all code from `src/main/kotlin` (or any other if applicable) is accessible in every `build.gradle.kts` within a project. For composite builds, you should register Gradle plugin and define it in the desired module (we won't discuss it in this specific article, it's just for you to know). 

Even in this solution, we have multiple variants of how we can use such an approach in the end, but let's use the best one in my opinion. In your root gradle project `build.gradle.kts` file, you can make next:
```kotlin
plugins {
	// we should do this for each plugin we use in modules
	// it will affect classpath and make us free of specifying version
	// every time
	id(Deps.Plugins.Kotlin.Id) version (Deps.Versions.kotlin) apply false
}
```

> ❓ **Explanation**
> In Gradle, the root module sets the tone for a multi-module project. Configurations, plugins, and dependencies defined in the root module automatically extend to all submodules. This ensures a uniform build environment across the project. The hierarchical structure simplifies management, allowing common settings at the root, with flexibility for customization in individual submodules.

In our modules we can use this plugin and our dependency in the following way:
```kotlin
plugins {
	// now we don't need to specify version, it's already on a classpath
	id(Deps.Plugins.Kotlin.Id)
}

// ... repositories

dependencies {
	implementation(Deps.Libs.kotlinxCoroutines)
}
```

What is the advantages? 
1. **Accessibility in code**: In the case of composite builds, we can use it as usual code without any problems from other composite builds [(my example)](https://github.com/y9vad9/kotlin-project-template/blob/2607858f0c604722c71f4d53187d5459f51eb945/build-logic/configuration/build.gradle.kts#L12) or even inside our code. As for version catalogs that we're going to discuss next, you can't use them as regular code in composite builds (important note: you can't use it inside `src/main/kotlin`, but inside its configuration, you can) without [hacks](https://github.com/gradle/gradle/pull/15443/files#diff-5e341d2605a36e31ef4c643790effcdbbf1d4ca23483da374e04aeb3781d4e87R1025) (also, it's possible only within right context).
2. **Better navigation and refactor**: Utilizing the same mechanism throughout your code improves IDE support, making navigation and refactoring more efficient. This built-in consistency enhances the overall development experience.

Now, let's talk about the disadvantages of this method:
- **Lack of standardization**: As it's not recommended by Gradle and not that common practice in the community, it makes your build logic more complex and less understandable.
- **Security Scans:** Almost all security scanners (except scanners that work as gradle plugins) don't support this method (for example, [related issue in Dependabot](https://github.com/dependabot/dependabot-core/issues/2280)), removing entirely the effectiveness of security analysis in the project.
- **Auto-updating**: Such a method does not have any support in IDE auto-updating / migrating feature (and as was mentioned before, same for the Dependabot)

Certain issues with dependency management methods can indeed be addressed (or ignored as unimportant for certain projects), although not without their trade-offs.

In summary, this method isn't the most maintainable or secure, [lacking integration with powerful tools like Dependabot](https://github.com/dependabot/dependabot-core/issues/2280). They are relatively straightforward but have such limitations. In the future it might be resolved, but for now, it's a big problem if you want to use Dependabot.

> **📝 Note**
> This also applies to the other variants, for example, `dependencies.gradle` files written in Groovy that provide constants for your build scripts – it's not checked by most of the scanners.

> **💡 Bonus**
> Regarding `buildSrc`, it also poses challenges. Using it can hinder reusability, add complexity, and complicate gradual project migrations. It might even lead to classpath issues and performance problems in complex usage scenarios. Consequently, I avoid using `buildSrc` in my projects due to these potential complications. For composite builds it's not always the case, but anyway makes your build configuration less understandable.

### Version catalogs

Now let's discuss a relatively recent innovation in Gradle – Version catalogs. What is version catalogs?

> **❓ Definition**
> Version catalog – it's a centralized file (in TOML format) in a Gradle project containing structured version information for libraries and plugins (usually located in `gradle/libs.versions.toml`).

Here's an example of such a definition:
```toml
[versions]
kotlin = "1.9.20-RC"
coroutines = "1.7.3"

[libraries]
kotlinx-coroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }

```

Inside `build.gradle.kts`:
```kotlin
plugins {
	// there's special function for version catalog definition
	alias(libs.plugins.kotlin.jvm)
}

dependencies {
	implementation(libs.kotlinx.coroutines)
}
```

> **📝 Note**
> You can create multiple TOML definition files, for details please refer to the [official manual](https://docs.gradle.org/current/userguide/platforms.html#ex-declaring-additional-catalogs). 

Why version catalogs?
1. **Standardization and Familiarity:** Version catalogs are recommended by Gradle, which makes them widely understood by developers. Their structured approach simplifies dependency management, making it accessible to a broad audience.
2. **Dependabot Compatibility:** Version catalogs seamlessly integrate with tools like Dependabot, ensuring that your project stays up-to-date with the latest library versions. This compatibility streamlines the process of managing dependencies and addressing security vulnerabilities. 
3. **IDE Support:** IDEs like IntelliJ IDEA provide built-in support for version catalogs. Developers can conveniently search for updates directly within the IDE, enhancing the development workflow and promoting efficient dependency management.

> **📝 Note**
> There're multiple ways of defining version catalogs, but, for example, Dependabot supports only reading from a file (it's worth mentioning that it will cover most of the cases). But, it might be [resolved in future](https://github.com/dependabot/dependabot-core/issues/1164).

Disadvantages:
1. **Limitation in Composite Builds:** Version catalogs struggle with integrating generated code in composite builds code. This constraint hampers the flexibility of using generated code as regular components, requiring additional effort and workarounds in composite build (and not only) scenarios.
2. **Refactoring**: If you want to change names or path of your dependencies, you will need to change it in your build configurations by hands as there's no builtin support of it within IDE (at least, at the moment when this article was written).

Overall, I am choosing this method for all my new projects as it's already a standard.

### Classpath
There're several ways how you can provide versions of your plugins by propagating it through classpath.

#### BuildScript
In older versions of Gradle, specifying plugin versions directly in the `buildscript` block was a common practice. It allowed developers to define the version of a plugin explicitly. Here's how it was typically done:
```kotlin
buildscript { 
	repositories { 
		mavenCentral() 
	} 
	
	dependencies { 
		classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.20-RC") 
	} 
}
```
In this approach, the version of the Kotlin Gradle plugin (`1.9.20-RC` in this example) is declared in the `buildscript` block. This version constraint ensures that the project uses the specified version of the plugin (but, it can be overwritten by submodules with special efforts).

Once the plugin version is specified in the `buildscript` block, applying the plugin becomes simplified. Developers can apply the plugin without explicitly specifying its version:
```kotlin
plugins {
	kotlin("jvm")
}
```
In this snippet, the `kotlin("jvm")` plugin is applied without mentioning the version. Gradle automatically refers to the version specified in the `buildscript` (to be more clear, buildscript evaluates before any other block in your script and adds specified dependencies in the classpath that is always used to resolve plugins and dependencies without a version specified; also it enforces specific version to be used as you cannot have the same plugin, but with different versions) block. 

**Pros:**
- **Explicit Versioning:** The version constraint is clearly defined in the build script, ensuring that the project uses a specific version of the plugin.
- **Consistent Versions:** All modules in the project automatically use the specified version, promoting consistency.
- **Auto-updating**: Intellij Idea (and Android Studio as well) supports auto-migration on such declarations.

**Cons:**
- **Maintenance Overhead:** Manually updating the version in the `buildscript` block for every plugin can be tedious, especially in large projects with numerous plugins.
- **Less Concise Build Scripts:** The `buildscript` block adds verbosity to the build script, potentially making it harder to read and maintain, especially as the number of plugins increases.
- **Security scanners compatibility**: Dependabot does not support vulnerability checks on such declarations.

While this method was widely used in the past, it's now considered less recommended due to the maintenance overhead and verbosity it introduces.

> **❓ Explanation**
> Modern Gradle practices discourage specifying plugin versions directly in the `buildscript` block for practical reasons. Instead, [it's recommended](https://docs.gradle.org/current/userguide/tutorial_using_tasks.html#sec:build_script_external_dependencies) to centralize version management using the [version catalogs](https://docs.gradle.org/current/userguide/platforms.html) or [`pluginManagement`](https://docs.gradle.org/current/userguide/plugins.html#sec:plugin_management) (we will discuss it lower). Plugin management approach enables, for example, [dynamic version resolution](https://docs.gradle.org/current/userguide/plugins.html#ex-plugin-resolution-strategy), simplifying build scripts and preventing unnecessary clutter.

#### `pluginManagement`
As was discussed before, it's a modern way to declare your plugin's version, repositories and resolution rules. Example:
```kotlin
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
    plugins {
        id("org.jetbrains.kotlin.jvm") version "1.9.20-RC"
    }
}
```
Additionally, you can enforce specific versions using `resolutionStrategy`:
```kotlin
pluginManagement {
    repositories {
        mavenCentral()
    }
    resolutionStrategy {
        eachPlugin {
            if (requested.id.namespace == "com.example") {
                useVersion("1.2.3") // Specify the desired version here
            }
        }
    }
}
```

##### **Pros of `pluginManagement`:**
1. **Lack of constraint syntax:** You can use versions from properties or any other supported source. You couldn't do the same with plugins, because [plugins block always evaluated separately](https://docs.gradle.org/current/userguide/plugins.html#sec:constrained_syntax) from other part of the build script.
2. **Dynamic Version Resolution:** You can replace versions or entire plugins source using [`resolutionStrategy`](https://docs.gradle.org/current/userguide/plugins.html#ex-plugin-resolution-strategy)

##### **Cons of `pluginManagement`:**
1. **Potential Complexity:**
    - **Con:** Overuse (or usage without real need) might lead to complex and harder-to-maintain scripts.
2. **Security scanners compatibility**: Dependabot does not support vulnerability checks on such declarations.

Overall, this feature should be used only if you have a special need, consider using simpler variants if all you need is the version controlling.

### BOM
A [BOM (Bill of Materials)](https://docs.gradle.org/current/userguide/platforms.html#sub:bom_import) in Gradle is a central version management tool for multiple dependencies. It's a file that lists compatible versions of libraries and their dependencies. Importing a BOM ensures consistent versions, minimizing conflicts in complex projects. BOMs simplify version control, providing stability and coherence across the project.

Here is the example of a BOM declaration:
```kotlin
javaPlatform {
    allowDependencies()
}

dependencies {
    constraints {
        api("org.slf4j:slf4j-api:2.0.9") 
        api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
        // ...
    }
}
```
And how to use it:
```kotlin
dependencies {
	implementation(enforcedPlatform(project(":some-bom")))
}
```

How exactly it help with project organizing?
- **Prevents Conflicts:** Ensures modules use compatible versions, avoiding conflicts.
- **Publishable**: You can easily publish your BOM to the Maven, for example, for your library consumers; you can't do the same with version catalogs (with the same simplicity), properties, etc.
- **Scanners compatibility**: `.pom` format that is used for BOMs that are published is easily recognized by most of the scanners (important note: that scan maven, Dependabot does not support it directly; but you always can use it all together with version catalogs, for example).

It's especially useful in cases where your libraries are tightly bound to specific versions of other libraries, compiler APIs, etc.

The main drawback is the possibility that you might not need this level of dependency declaration and might prefer simpler options like version catalogs.

## Conclusion
We have explored various methods of defining dependencies and managing plugins and their versions. It's crucial to emphasize that your choice should align with the specific requirements of your project. For instance, the `pluginManagement` block can handle plugin versions, but it might unnecessarily complicate your build configuration without providing substantial benefits. Similarly, opting for constants in composite builds or `buildSrc` should be a decision based on actual necessity, considering both advantages and potential drawbacks. Always assess the real needs of your project before making these choices.
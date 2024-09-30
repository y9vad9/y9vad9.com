package com.y9vad9.localization

import com.y9vad9.types.Article
import com.y9vad9.types.Project

object EnglishStrings : Strings {
    override val homeTitle: String = "Home"
    override val projectsTitle: String = "Projects"
    override val blogTitle: String = "Blog"
    override val myName: String = "Vadym Yaroshchuk"
    override val myDescription: String = "I'm a Kotlin Software Engineer with 6 years of experience, mostly from personal projects. While my professional experience is limited, I've gained practical skills by working on various applications, focusing on Kotlin Multiplatform and client-server development. I enjoy solving complex problems, simplifying code, and sharing what I’ve learned through teaching and writing."
    override val learnMore: String = "Learn more"
    override val projects: List<Project> = listOf(
        Project(
            name = "RSP",
            description = "RSP is a framework designed to provide an ability to expose your API as RPC Services using RSocket. It facilitates the creation of gRPC-like services from .proto files through code generation. The framework also provides essential core components for both server and client.",
            url = "https://github.com/rsproto/rsp-kotlin",
            imageUrl = "rsp-logo.png",
            roundImage = false,
        ),
        Project(
            name = "TimeMates",
            description = "The application for time-management and collaboration. With TimeMates, you can achieve a perfect work-life balance while staying productive and efficient. Time-boxing feature allows you to easily set up a timer that fits your schedule, whether you're working on a project or taking a break. TimeMates isn't just another time-management tool; it's a lifestyle change.",
            url = "https://github.com/timemates",
            imageUrl = "timemates-icon.png"
        ),
        Project(
            name = "Kotlin Course",
            description = "Kotlin course that's perfect for very-very beginners. It's available in both Ukrainian and English versions, and it's divided into two tracks - one for Gradle and one for Kotlin.",
            url = "https://github.com/y9vad9/kotlin-course",
            imageUrl = "kotlin-course-icon.png",
            roundImage = false,
        )
    )
    override val articles: List<Article> = listOf(
        Article(
            name = "Digging Deep to Find the Right Balance Between DDD, Clean and Hexagonal Architectures",
            description = "Article about combining and implementing together Domain-driven Design, Clean and Hexagonal Architectures.",
            url = "https://dev.to/y9vad9/digging-deep-to-find-the-right-balance-between-ddd-clean-and-hexagonal-architectures-4dnn",
            previewUrl = "previews/DDD-Hexagonal-Article-Preview.jpg"
        ),
        Article(
            name = "Finding the Right Balance in Gradle Dependency Strategy",
            description = "Discover different approaches to managing dependencies in Gradle. Whether you're a newbie or a pro, there's something here for you.",
            url = "https://dev.to/y9vad9/finding-the-right-balance-in-gradle-dependency-strategy-4jdl",
            previewUrl = "previews/gradle-dependency-strategy.jpg",
        ),
        Article(
            name = "Gradle: from Newbie to Strong fundamentals",
            description = "Dive into the world of Gradle as I explore plugins, dependencies, repositories, project structures, and even multi-module projects (with their quirks!). Whether you're new to Gradle or aiming to solidify your basics, this one's for you!",
            url = "https://dev.to/y9vad9/gradle-from-newbie-to-strong-fundamentals-mdf",
            previewUrl = "previews/gradle-for-newbies.jpg",
        ),
        Article(
            name = "Kotlin: Coroutines are not just about concurrency",
            description = "Discover the ins and outs of Kotlin Coroutines, from the ground up. In this piece, I break down the fundamentals and delve into their inner workings. Plus, I share some cool examples of how they can be used beyond the realm of concurrency.",
            url = "https://dev.to/y9vad9/coroutines-are-not-just-about-concurrency-4bfe",
            previewUrl = "previews/coroutines-beyond-concurrency.jpg",
        ),
        Article(
            name = "Extension Oriented Design in Kotlin",
            description = "Unlock the Potential of Extension-Oriented Design in Code-Writing. Learn how extension functions offer solutions for accessing classes, bypassing restrictions on inline functions, and organizing code more efficiently. Discover the benefits of this approach and improve your code today.",
            url = "https://dev.to/y9vad9/extension-oriented-design-3d41",
            previewUrl = "previews/EOD-Kotlin.jpg",

        )
    )
    override val exploreTitle: String = "Explore"
}
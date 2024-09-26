package com.y9vad9.localization

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import com.y9vad9.types.Article
import com.y9vad9.types.Project

interface Strings {
    companion object {
        val local: ProvidableCompositionLocal<Strings> = staticCompositionLocalOf {
            EnglishStrings
        }

        val current: Strings @Composable get() = local.current
    }
    val homeTitle: String
    val projectsTitle: String
    val blogTitle: String

    val myName: String
    val myDescription: String

    val learnMore: String

    val projects: List<Project>
    val articles: List<Article>

    val exploreTitle: String
}

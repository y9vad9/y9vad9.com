import com.varabyte.kobweb.gradle.application.util.configAsKobwebApplication
import kotlinx.html.link

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kobweb.application)
    alias(libs.plugins.kobwebx.markdown)
}

group = "com.y9vad9"
version = "1.0-SNAPSHOT"

kobweb {
    app {
        index {
            head.add {
                link {
                    rel = "stylesheet"
                    href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
                }
            }
            description.set("Vadym Yaroshchuk's personal site")
        }
    }
}

kotlin {
    configAsKobwebApplication("y9vad9")

    sourceSets {
        commonMain.dependencies {
            implementation(libs.compose.runtime)
        }

        jsMain.dependencies {
            implementation(libs.compose.html.core)
            implementation(libs.kobweb.core)
            implementation(libs.kobweb.silk)
            implementation(libs.silk.icons.fa)
            implementation(libs.kobwebx.markdown)
        }
    }
}

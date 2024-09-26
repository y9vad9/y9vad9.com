package com.y9vad9.pages

import androidx.compose.runtime.Composable
import com.varabyte.kobweb.compose.css.FontSize
import com.varabyte.kobweb.compose.css.FontWeight
import com.varabyte.kobweb.compose.css.Height
import com.varabyte.kobweb.compose.foundation.layout.*
import com.varabyte.kobweb.compose.ui.Alignment
import com.varabyte.kobweb.compose.ui.Modifier
import com.varabyte.kobweb.compose.ui.modifiers.*
import com.varabyte.kobweb.core.Page
import com.varabyte.kobweb.core.rememberPageContext
import com.varabyte.kobweb.silk.components.forms.Button
import com.varabyte.kobweb.silk.components.graphics.Image
import com.varabyte.kobweb.silk.components.text.SpanText
import com.varabyte.kobweb.silk.theme.colors.ColorSchemes
import com.y9vad9.SitePalette
import com.y9vad9.SitePalettes
import com.y9vad9.components.layouts.PageLayout
import com.y9vad9.localization.Strings
import org.jetbrains.compose.web.css.Color
import org.jetbrains.compose.web.css.LineStyle
import org.jetbrains.compose.web.css.cssRem
import org.jetbrains.compose.web.css.px
import org.jetbrains.compose.web.dom.H1

@Page
@Composable
fun ArticlesPage() {
    val ctx = rememberPageContext()

    PageLayout(Strings.current.projectsTitle) {
        Column(
            modifier = Modifier.fillMaxSize().padding(1.cssRem).margin(bottom = 2.cssRem),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(1.cssRem),
        ) {
            H1 {
                SpanText(
                    modifier = Modifier.fontFamily("Jetbrains Mono"),
                    text = Strings.current.projectsTitle,
                )
            }

            Strings.current.projects.forEach { project ->
                Column(
                    modifier = Modifier
                        .borderRadius(16.px)
                        .border(1.px, color = Color.darkgray, style = LineStyle.Solid)
                        .maxWidth(600.px)
                        .margin(16.px)
                        .padding(16.px)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            src = project.imageUrl,
                            modifier = Modifier
                                .size(24.px)
                                .margin(right = 8.px)
                                .then(if (project.roundImage) Modifier.borderRadius(6.px) else Modifier)
                        )


                        SpanText(
                            text = project.name,
                            modifier = Modifier.fontWeight(FontWeight.Bold).fontSize(FontSize.Large),
                        )
                    }
                    SpanText(
                        project.description,
                        modifier = Modifier
                            .fontWeight(FontWeight.Lighter)
                            .fontSize(FontSize.Medium)
                            .height(Height.Inherit)
                            .margin(top = 8.px)
                    )
                    Spacer()

                    Box(
                        modifier = Modifier.padding(top = 16.px).fillMaxWidth(),
                        contentAlignment = Alignment.BottomEnd
                    ) {
                        Button(
                            onClick = { ctx.router.navigateTo(project.url) },
                            modifier = Modifier.fillMaxWidth(),
                            colorScheme = ColorSchemes.DeepPurple,
                        ) {
                            SpanText(
                                modifier = Modifier.fontFamily("JetBrains Mono"),
                                text = Strings.current.exploreTitle
                            )
                        }
                    }
                }
            }
        }
    }
}
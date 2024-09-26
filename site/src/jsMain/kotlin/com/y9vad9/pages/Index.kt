package com.y9vad9.pages

import androidx.compose.runtime.Composable
import com.varabyte.kobweb.compose.css.StyleVariable
import com.varabyte.kobweb.compose.foundation.layout.Box
import com.varabyte.kobweb.compose.foundation.layout.Column
import com.varabyte.kobweb.compose.foundation.layout.Row
import com.varabyte.kobweb.compose.ui.Alignment
import com.varabyte.kobweb.compose.ui.Modifier
import com.varabyte.kobweb.compose.ui.graphics.Color
import com.varabyte.kobweb.compose.ui.graphics.Colors
import com.varabyte.kobweb.compose.ui.modifiers.*
import com.varabyte.kobweb.compose.ui.toAttrs
import com.varabyte.kobweb.core.Page
import com.varabyte.kobweb.core.rememberPageContext
import com.varabyte.kobweb.silk.components.forms.Button
import com.varabyte.kobweb.silk.components.graphics.Image
import com.varabyte.kobweb.silk.components.icons.fa.FaGithub
import com.varabyte.kobweb.silk.components.icons.fa.FaInstagram
import com.varabyte.kobweb.silk.components.icons.fa.FaLinkedin
import com.varabyte.kobweb.silk.components.icons.fa.FaTelegram
import com.varabyte.kobweb.silk.components.text.SpanText
import com.varabyte.kobweb.silk.style.CssStyle
import com.varabyte.kobweb.silk.style.base
import com.varabyte.kobweb.silk.style.breakpoint.Breakpoint
import com.varabyte.kobweb.silk.style.breakpoint.displayIfAtLeast
import com.varabyte.kobweb.silk.style.breakpoint.displayUntil
import com.varabyte.kobweb.silk.style.toAttrs
import com.varabyte.kobweb.silk.style.toModifier
import com.varabyte.kobweb.silk.theme.colors.ColorMode
import com.varabyte.kobweb.silk.theme.colors.ColorSchemes
import com.y9vad9.HeadlineTextStyle
import com.y9vad9.SubheadlineTextStyle
import com.y9vad9.components.layouts.PageLayout
import com.y9vad9.components.widgets.IconButton
import com.y9vad9.localization.Strings
import com.y9vad9.toSitePalette
import org.jetbrains.compose.web.css.cssRem
import org.jetbrains.compose.web.dom.B
import org.jetbrains.compose.web.dom.Div

// Container that has a tagline and grid on desktop, and just the tagline on mobile
val HeroContainerStyle = CssStyle {
    base { Modifier.fillMaxWidth().gap(2.cssRem) }
    //Breakpoint.MD { Modifier.margin { top(2.vh) } }
}

// A demo grid that appears on the homepage because it looks good
val HomeGridStyle = CssStyle.base {
    Modifier
        .gap(0.5.cssRem)
        .width(70.cssRem)
        .height(18.cssRem)
}

private val GridCellColorVar by StyleVariable<Color>()
val HomeGridCellStyle = CssStyle.base {
    Modifier
        .backgroundColor(GridCellColorVar.value())
        .boxShadow(blurRadius = 0.6.cssRem, color = GridCellColorVar.value())
        .borderRadius(1.cssRem)
}

@Composable
private fun GridCell(color: Color, row: Int, column: Int, width: Int? = null, height: Int? = null) {
    Div(
        HomeGridCellStyle.toModifier()
            .setVariable(GridCellColorVar, color)
            .gridItem(row, column, width, height)
            .toAttrs()
    )
}

@Page
@Composable
fun HomePage() {
    PageLayout("Home") {
        Row(HeroContainerStyle.toModifier(), verticalAlignment = Alignment.CenterVertically) {
            Box {
                ColorMode.current.toSitePalette()

                val ctx = rememberPageContext()

                Column(Modifier.gap(1.cssRem)) {
                    Div(HeadlineTextStyle.toAttrs()) {
                        B {
                            SpanText(
                                Strings.current.myName, Modifier.color(
                                    when (ColorMode.current) {
                                        ColorMode.LIGHT -> Colors.Black
                                        ColorMode.DARK -> Colors.White
                                    }
                                )
                            )
                        }
                    }

                    Div(SubheadlineTextStyle.toAttrs()) {
                        SpanText(Strings.current.myDescription)
                    }

                    Row {
                        IconButton(
                            onClick = {
                                ctx.router.navigateTo(
                                    "https://t.me/vadymlog"
                                )
                            },
                        ) {
                            FaTelegram()
                        }

                        IconButton(
                            onClick = {
                                ctx.router.navigateTo(
                                    "https://github.com/y9vad9"
                                )
                            },
                        ) {
                            FaGithub()
                        }

                        IconButton(
                            onClick = {
                                ctx.router.navigateTo(
                                    "https://linkedin.com/in/y9vad9"
                                )
                            },
                        ) {
                            FaLinkedin()
                        }

                        IconButton(
                            onClick = {
                                ctx.router.navigateTo(
                                    "https://instagram.com/p/y9vad9"
                                )
                            },
                        ) {
                            FaInstagram()
                        }
                    }

                    Button(
                        onClick = {
                            ctx.router.navigateTo(
                                "https://linkedin.com/in/y9vad9"
                            )
                        },
                        colorScheme = ColorSchemes.DeepPurple,
                    ) {
                        SpanText(
                            modifier = Modifier.fontFamily("JetBrains Mono"),
                            text = "Learn more",
                        )
                    }
                }
            }

            Image(
                src = "y9vad9-standing-pos.png",
                modifier = Modifier.height(30.cssRem)
                    .displayIfAtLeast(Breakpoint.MD)
                    .borderRadius(1.cssRem)
            )
        }
    }
}

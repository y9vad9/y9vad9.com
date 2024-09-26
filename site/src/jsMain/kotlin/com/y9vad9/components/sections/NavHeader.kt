package com.y9vad9.components.sections

import androidx.compose.runtime.*
import com.varabyte.kobweb.browser.dom.ElementTarget
import com.varabyte.kobweb.compose.css.functions.clamp
import com.varabyte.kobweb.compose.foundation.layout.Arrangement
import com.varabyte.kobweb.compose.foundation.layout.Column
import com.varabyte.kobweb.compose.foundation.layout.Row
import com.varabyte.kobweb.compose.foundation.layout.Spacer
import com.varabyte.kobweb.compose.ui.Alignment
import com.varabyte.kobweb.compose.ui.Modifier
import com.varabyte.kobweb.compose.ui.graphics.Colors
import com.varabyte.kobweb.compose.ui.modifiers.*
import com.varabyte.kobweb.silk.components.graphics.Image
import com.varabyte.kobweb.silk.components.icons.CloseIcon
import com.varabyte.kobweb.silk.components.icons.HamburgerIcon
import com.varabyte.kobweb.silk.components.icons.MoonIcon
import com.varabyte.kobweb.silk.components.icons.SunIcon
import com.varabyte.kobweb.silk.components.layout.HorizontalDivider
import com.varabyte.kobweb.silk.components.navigation.Link
import com.varabyte.kobweb.silk.components.navigation.UncoloredLinkVariant
import com.varabyte.kobweb.silk.components.navigation.UndecoratedLinkVariant
import com.varabyte.kobweb.silk.components.overlay.Overlay
import com.varabyte.kobweb.silk.components.overlay.OverlayVars
import com.varabyte.kobweb.silk.components.overlay.PopupPlacement
import com.varabyte.kobweb.silk.components.overlay.Tooltip
import com.varabyte.kobweb.silk.style.CssStyle
import com.varabyte.kobweb.silk.style.animation.Keyframes
import com.varabyte.kobweb.silk.style.animation.toAnimation
import com.varabyte.kobweb.silk.style.base
import com.varabyte.kobweb.silk.style.breakpoint.Breakpoint
import com.varabyte.kobweb.silk.style.breakpoint.displayIfAtLeast
import com.varabyte.kobweb.silk.style.breakpoint.displayUntil
import com.varabyte.kobweb.silk.style.toModifier
import com.varabyte.kobweb.silk.theme.colors.ColorMode
import org.jetbrains.compose.web.css.*
import com.y9vad9.components.widgets.IconButton
import com.y9vad9.localization.Strings
import com.y9vad9.toSitePalette
import org.jetbrains.compose.web.dom.B
import org.jetbrains.compose.web.dom.Div
import org.jetbrains.compose.web.dom.H1
import org.jetbrains.compose.web.dom.H2
import org.jetbrains.compose.web.dom.H3
import org.jetbrains.compose.web.dom.Text

val NavHeaderStyle = CssStyle.base {
    Modifier.fillMaxWidth().padding(1.cssRem)
        .backgroundColor(colorMode.toSitePalette().nearBackground)
}

@Composable
private fun NavLink(path: String, text: String, selected: Boolean) {
    Link(
        modifier = if (selected) Modifier.color(Color.purple) else Modifier,
        path = path,
        variant = UndecoratedLinkVariant.then(UncoloredLinkVariant),
        text = text,
    )
}

@Composable
private fun MenuItems(current: String) {
    NavLink("/", Strings.current.homeTitle, Strings.current.homeTitle == current)
    NavLink("/projects", Strings.current.projectsTitle, Strings.current.projectsTitle == current)
    NavLink("/blog", Strings.current.blogTitle, Strings.current.blogTitle == current)
}

@Composable
private fun ColorModeButton() {
    var colorMode by ColorMode.currentState
    IconButton(onClick = { colorMode = colorMode.opposite },) {
        if (colorMode.isLight) MoonIcon() else SunIcon()
    }
    Tooltip(ElementTarget.PreviousSibling, "Toggle color mode", placement = PopupPlacement.BottomRight)
}

@Composable
private fun HamburgerButton(onClick: () -> Unit) {
    IconButton(onClick) {
        HamburgerIcon()
    }
}

@Composable
private fun CloseButton(onClick: () -> Unit) {
    IconButton(onClick) {
        CloseIcon()
    }
}

val SideMenuSlideInAnim = Keyframes {
    from {
        Modifier.translateX(100.percent)
    }

    to {
        Modifier
    }
}

// Note: When the user closes the side menu, we don't immediately stop rendering it (at which point it would disappear
// abruptly). Instead, we start animating it out and only stop rendering it when the animation is complete.
enum class SideMenuState {
    CLOSED,
    OPEN,
    CLOSING;

    fun close() = when (this) {
        CLOSED -> CLOSED
        OPEN -> CLOSING
        CLOSING -> CLOSING
    }
}

@Composable
fun NavHeader(currentPage: String) {
    Column(NavHeaderStyle.toModifier(), verticalArrangement = Arrangement.spacedBy(8.px)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {

            B {
                Text(Strings.current.myName)
            }

            Spacer()

            Row(
                modifier = Modifier.gap(1.5.cssRem).displayIfAtLeast(Breakpoint.MD),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MenuItems(currentPage)
                ColorModeButton()
            }

            Row(
                Modifier
                    .fontSize(1.5.cssRem)
                    .gap(1.cssRem)
                    .displayUntil(Breakpoint.MD),
                verticalAlignment = Alignment.CenterVertically
            ) {
                var menuState by remember { mutableStateOf(SideMenuState.CLOSED) }

                ColorModeButton()
                HamburgerButton(onClick = { menuState = SideMenuState.OPEN })

                if (menuState != SideMenuState.CLOSED) {
                    SideMenu(
                        currentPage,
                        menuState,
                        close = { menuState = menuState.close() },
                        onAnimationEnd = { if (menuState == SideMenuState.CLOSING) menuState = SideMenuState.CLOSED }
                    )
                }
            }
        }
    }
}

@Composable
private fun SideMenu(
    current: String,
    menuState: SideMenuState,
    close: () -> Unit,
    onAnimationEnd: () -> Unit,
) {
    Overlay(
        Modifier
            .setVariable(OverlayVars.BackgroundColor, Colors.Transparent)
            .onClick { close() }
    ) {
        key(menuState) { // Force recompute animation parameters when close button is clicked
            Column(
                Modifier
                    .fillMaxHeight()
                    .width(clamp(8.cssRem, 33.percent, 10.cssRem))
                    .align(Alignment.CenterEnd)
                    // Close button will appear roughly over the hamburger button, so the user can close
                    // things without moving their finger / cursor much.
                    .padding(top = 1.cssRem, leftRight = 1.cssRem)
                    .gap(1.5.cssRem)
                    .backgroundColor(ColorMode.current.toSitePalette().nearBackground)
                    .animation(
                        SideMenuSlideInAnim.toAnimation(
                            duration = 200.ms,
                            timingFunction = if (menuState == SideMenuState.OPEN) AnimationTimingFunction.EaseOut else AnimationTimingFunction.EaseIn,
                            direction = if (menuState == SideMenuState.OPEN) AnimationDirection.Normal else AnimationDirection.Reverse,
                            fillMode = AnimationFillMode.Forwards
                        )
                    )
                    .borderRadius(topLeft = 2.cssRem)
                    .onClick { it.stopPropagation() }
                    .onAnimationEnd { onAnimationEnd() },
                horizontalAlignment = Alignment.End
            ) {
                CloseButton(onClick = { close() })
                Column(Modifier.padding(right = 0.75.cssRem).gap(1.5.cssRem).fontSize(1.2.cssRem), horizontalAlignment = Alignment.End) {
                    MenuItems(current)
                }
            }
        }
    }
}

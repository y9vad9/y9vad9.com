package com.y9vad9

import com.varabyte.kobweb.compose.ui.graphics.Color
import com.varabyte.kobweb.compose.ui.graphics.Colors
import com.varabyte.kobweb.silk.init.InitSilk
import com.varabyte.kobweb.silk.init.InitSilkContext
import com.varabyte.kobweb.silk.theme.colors.ColorMode
import com.varabyte.kobweb.silk.theme.colors.palette.background
import com.varabyte.kobweb.silk.theme.colors.palette.color

/**
 * @property nearBackground A useful color to apply to a container that should differentiate itself from the background
 *   but just a little.
 */
class SitePalette(
    val nearBackground: Color, val brand: Brand,
) {
    class Brand(
        val primary: Color = Color.rgb(0x657FD4),
        val accent: Color = Color.rgb(0xBE35BC),
    )
}

object SitePalettes {
    val light = SitePalette(
        nearBackground = Color.rgb(0xF4F6FA),
        brand = SitePalette.Brand()
    )
    val dark = SitePalette(
        nearBackground = Color.rgb(0x13171F),
        brand = SitePalette.Brand()
    )
}

fun ColorMode.toSitePalette(): SitePalette {
    return when (this) {
        ColorMode.LIGHT -> SitePalettes.light
        ColorMode.DARK -> SitePalettes.dark
    }
}

@InitSilk
fun initTheme(ctx: InitSilkContext) {
    ctx.theme.palettes.light.background = Color.rgb(0xFAFAFA)
    ctx.theme.palettes.light.color = Colors.Black
    ctx.theme.palettes.dark.background = Color.rgb(0x06080B)
    ctx.theme.palettes.dark.color = Colors.White
}

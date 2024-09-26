package com.y9vad9.types

data class Project(
    val imageUrl: String,
    val name: String,
    val description: String,
    val url: String,
    val roundImage: Boolean = true,
)
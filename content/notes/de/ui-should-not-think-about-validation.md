---
epic: false
title: UI sollte nicht über Validierung nachdenken
preview: "Wie ich die Validierung in einem meiner Projekte strukturiert habe"
date: 2026-02-27
parents: ["Softwaredesign"]
---
Kürzlich habe ich daran gearbeitet, den Präsentations-Layer vom UI-Layer zu abstrahieren. Im Idealfall sollte der UI-Layer in Bezug auf jegliche Nicht-UI-Logik so "dumm" wie möglich sein. Allerdings leidet der Präsentations-Layer oft unter einem grundlegenden Designfehler: Er versucht zu entscheiden, _was_ die UI tun soll.

Dies geschieht entweder direkt (durch Übergabe eines bestimmten Fehler-`String`s zur Anzeige) oder indirekt (durch Übergabe eines `Int`-Identifiers für eine String-Ressource). Letzteres erzeugt ein falsches Gefühl der Entkopplung (Decoupling) – der Präsentations-Layer diktiert immer noch die genaue Bildschirmausgabe.

Dieser Ansatz bricht das Prinzip der Separation of Concerns (SoC). Die Lösung besteht darin, genügend Kontextinformationen bereitzustellen, damit die UI selbst entscheiden kann, wie der Fehler angezeigt werden soll, ohne Präsentations- oder Domänenlogik preiszugeben.

Mein spezifisches Problemgebiet war die Validierung von Formulareingaben. Ich musste UI-Formatierungsfehler (z. B. Längenbeschränkungen) anzeigen und gleichzeitig die Eingabevalidierung streng von den Domänen-Invarianten getrennt halten – eine Unterscheidung, die viele Entwickler übersehen.

Die anfängliche Lösung in meinem Kopf war einfach: Warum nicht einfach Enums bereitstellen?
```kotlin
data class TaskCreateState(  
    val name: Input<NameIssue>,  
    val description: Input<DescriptionIssue>,  
    val dueDate: Input<DueDateIssue>,  
    val tags: Input<TagsIssue>,  
    val capturedTags: List<String> = emptyList(),  
) : TaskComponent.State {  
    enum class NameIssue { BLANK, TOO_SHORT, TOO_LONG }  
    enum class DescriptionIssue { BLANK, TOO_SHORT, TOO_LONG }  
    enum class DueDateIssue { FORMAT, INEXISTING_DATETIME, IN_PAST }  
    enum class TagsIssue { TOO_MANY }  
  
    val hasAnyIssues: Boolean get() = listOf(name, description, dueDate, tags).hasAnyIssues  
}
```
Wobei `Input` wie folgt aussieht:
```kotlin
@ConsistentCopyVisibility  
public data class Input<I> internal constructor(  
    val rawString: String,  
    val issues: List<I> = emptyList(),  
    val isValidated: Boolean = false,  
    private val validator: InputValidator<I>,  
) {  
    public fun validated(): Input<I> {  
        return copy(  
            issues = validator.validate(rawString),  
            isValidated = true,  
        )  
    }  
}  
  
public fun <I> input(  
    rawString: String = "",  
    validate: (String) -> List<I>  
): Input<I> = Input(  
    rawString = rawString,  
    issues = emptyList(),  
    isValidated = false,  
    validator = validate,  
)  
  
public fun <I> input(  
    rawString: String,  
    vararg issues: I,  
    validate: (String) -> List<I>  
): Input<I> = Input(  
    rawString = rawString,  
    issues = issues.asList(),  
    isValidated = true,  
    validator = validate  
)  
  
public val <I> Input<I>.hasAnyIssue: Boolean  
    get() = (if (isValidated) this else validated()).issues.isNotEmpty()  
  
public val List<Input<*>>.hasAnyIssues: Boolean  
    get() = any { it.hasAnyIssue }
    
public fun interface InputValidator<I> {  
    public fun validate(rawString: String): List<I>  
}
```

Es sieht sauber aus, aber bei der weiteren Ausarbeitung zeigte sich ein Problem: Wenn ein Enum einfach `TOO_LONG` sagt, muss die UI immer noch die Eingabegröße berechnen oder die maximale Länge aus der Domäne abrufen, um eine sinnvolle Fehlermeldung anzuzeigen. Das ist nicht so "dumm", wie ich es gerne hätte.

Enums waren nicht die Lösung. Stattdessen bin ich zu sealed Strukturen gewechselt, um Validierungsfehler darzustellen. Diese datenreichen Issues geben der UI genug Kontext, um den Fehler zu rendern, ohne sie zum Nachdenken oder Rechnen zu zwingen:
```kotlin
class TaskNameValidator : InputValidator<TaskNameIssue> {  
    override fun validate(rawString: String): List<TaskNameIssue> {  
        if (rawString.isBlank()) return listOf(TaskNameIssue.Blank)  
  
        return when (TaskName.create(rawString)) {  
            TaskName.CreationResult.TooShort -> listOf(  
                TaskNameIssue.TooShort(  
                    minLength = TaskName.MIN_LENGTH,  
                    currentLength = rawString.length,  
                )  
            )  
  
            TaskName.CreationResult.TooLong -> listOf(  
                TaskNameIssue.TooLong(  
                    maxLength = TaskName.MAX_LENGTH,  
                    currentLength = rawString.length,  
                )  
            )  
  
            is TaskName.CreationResult.Success -> emptyList()  
        }  
    }  
}  
  
sealed interface TaskNameIssue {  
    data object Blank : TaskNameIssue  
    data class TooShort(val minLength: Int, val currentLength: Int) : TaskNameIssue  
    data class TooLong(val maxLength: Int, val currentLength: Int) : TaskNameIssue  
}
```
Jetzt erhält die UI jedes Detail, das sie benötigt. Ich habe die "Jagd nach dem Entscheidungskontext" (decision context hunt) im UI-Layer eliminiert, da er die Implementierungsdetails des Präsentations-Layers oder die Domänen-Constraints nicht mehr kennen muss.

Ein weiterer Vorteil dieses Ansatzes ist die Komposition von Validatoren. Ich kann gemeinsame Validatoren (common validators) über verschiedene Screens hinweg verwenden oder sie mit screen-spezifischen benutzerdefinierten Validatoren kombinieren, wenn die Geschäftslogik variiert. Manche mögen argumentieren, dass dies Code-Duplizierung mit sich bringt, aber striktes SoC (sowohl auf Layer-Ebene als auch lokal) ist diesen Kompromiss immer wert. Außerdem denke ich nicht, dass dies in der KI-Ära ein großer Bottleneck ist (aber ehrlich gesagt dauert es auch ohne KI nicht allzu lange).

---
epic: false
title: UI shouldn't think about validation
preview: "How I structured validation in one of my projects"
date: 2026-02-27
parents: ["Software Design"]
---
I recently worked on abstracting the presentation layer from the UI layer. Ideally, the UI layer should be as dumb as possible when it comes to any non-UI logic. However, the presentation layer often suffers from a fundamental architectural flaw: it tries to decide _what_ the UI should do.

This happens either directly (passing a specific error `String` to display) or indirectly (passing a string resource `Int` identifier). The latter creates a false sense of decoupling — the presentation layer is still dictating the exact screen output.

This approach breaks the Separation of Concerns (SoC). The solution is to provide enough contextual information for the UI to decide for itself how to display the error, without leaking presentation or domain logic.

My specific problem area was form input validation. I needed to show UI formatting errors (e.g., length limits) while keeping input validation strictly separated from domain invariants — a distinction many developers miss.

The initial solution in my head was simple: why not just provide enums?
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
Where input is:
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
It looks clean, but iterating on this revealed a problem: if an enum simply says `TOO_LONG`, the UI still has to calculate the input size or fetch the max length from the domain to show a meaningful error message. It's not as dumb as I want it to be.

Enums weren't the solution. Instead, I migrated to `sealed` structures to represent validation errors. These data-rich issues give the UI enough context to render the error without forcing it to think or calculate:
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

Now, the UI receives every detail it needs. I eliminated the "decision context hunt" in the UI layer, as it no longer needs to know the presentation layer's implementation details or domain constraints.

Another benefit of this approach is validator composition. I can use common validators across different screens, or compose them with screen-specific custom validators when business logic varies. Some might argue this involves code duplication, but strict SoC (both at the layer level and locally) is always worth the trade-off. Also, I don't think it's a big bottleneck in the era of AI (but, honestly, even without it, it doesn't take that much time).
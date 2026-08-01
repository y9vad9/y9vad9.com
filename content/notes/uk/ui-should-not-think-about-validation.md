---
epic: false
title: UI не повинен думати про валідацію
preview: "Як я структурував валідацію в одному зі своїх проєктів"
date: 2026-02-27
parents: ["Проєктування ПЗ"]
---
Нещодавно я відділяв шар представлення (presentation layer) від UI-шару. В ідеалі UI має бути максимально «тупим» в усьому, що не стосується власне UI. Проте в шарі представлення часто сидить фундаментальна архітектурна вада: він намагається вирішувати, _що саме_ робити UI.

Буває це або прямо — коли він віддає готовий `String` з текстом помилки, — або опосередковано, коли передає `Int`-ідентифікатор рядкового ресурсу. Другий варіант лише вдає слабку зв’язність (decoupling): шар представлення однаково диктує точний результат на екрані.

Такий підхід ламає розділення відповідальності (Separation of Concerns, SoC). Вихід — дати UI достатньо контексту, щоб він сам вирішив, як показати помилку, і щоб при цьому нікуди не протекла ні логіка представлення, ні доменна.

Конкретно в мене все впиралося у валідацію вводу у формах. Треба було показувати в UI помилки формату (наприклад, обмеження довжини) і водночас тримати валідацію вводу суворо окремо від доменних інваріантів — різницю, яку багато розробників не бачать.

Перше, що спало на думку, було просте: а чому б не обійтися enum-ами?
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
Де Input виглядає так:
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
Виглядає чисто, але щойно я почав це докручувати, вилізла проблема: якщо enum каже лише TOO_LONG, UI все одно мусить сам порахувати довжину вводу або дістати максимальну довжину з домену, щоб показати людське повідомлення про помилку. А це вже не той «тупий» UI, якого я хотів.

Тож enum-и не підійшли. Замість них я перейшов на sealed-структури, які описують помилки валідації. Такі помилки (issues) везуть дані із собою й дають UI достатньо контексту для рендеру — думати чи щось рахувати йому вже не треба:
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
Тепер UI має всі деталі, які йому потрібні. UI-шар більше не «полює за контекстом» (decision context hunt): йому вже не треба знати ні деталей реалізації шару представлення, ні доменних обмежень.

Ще один плюс такого підходу — валідатори добре композуються. Спільні валідатори я перевикористовую на різних екранах, а там, де бізнес-логіка відрізняється, докручую до них кастомні під конкретний екран. Хтось скаже, що це дублювання коду, — але суворий SoC (і на рівні шарів, і локально) завжди вартий такого компромісу. Та й не думаю, що в епоху ШІ це такий уже боттлнек (хоча, чесно кажучи, і без нього писати їх недовго).
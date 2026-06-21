---
epic: false
title: UI не повинен думати про валідацію
preview: "Як я структурував валідацію в одному зі своїх проєктів"
date: 2026-02-27
parents: ["Проєктування ПЗ"]
---
Нещодавно я працював над абстрагуванням шару представлення (presentation layer) від UI-шару. В ідеалі, коли справа доходить до будь-якої не-UI логіки, UI повинен бути максимально «тупим». Проте шар представлення часто страждає від фундаментальної архітектурної вади: він намагається вирішувати, _що саме_ має робити UI.

Це відбувається або прямо (передача конкретного `String` з помилкою для відображення), або опосередковано (передача `Int` ідентифікатора рядкового ресурсу). Останнє створює хибне відчуття слабкої зв'язності (decoupling) — шар представлення все ще диктує точний результат на екрані.

Такий підхід порушує принцип розділення відповідальності (Separation of Concerns, SoC). Рішення полягає в тому, щоб надати достатньо контекстної інформації, аби UI міг самостійно вирішити, як відобразити помилку, без витоку логіки представлення чи домену.

Моєю конкретною проблемою була валідація вводу у формах. Мені потрібно було показувати помилки форматування в UI (наприклад, обмеження довжини), при цьому зберігаючи валідацію вводу суворо відокремленою від доменних інваріантів — різниця, яку багато розробників упускають.

Початкове рішення в моїй голові було простим: чому б просто не використати enum-и?
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
Виглядає чисто, але подальша робота над цим виявила проблему: якщо enum просто каже TOO_LONG, UI все одно повинен обчислити розмір вводу або дістати максимальну довжину з домену, щоб показати змістовне повідомлення про помилку. Це вже не той «тупий» UI, який я хотів бачити.

Enum-и виявилися не найкращим рішенням. Замість них я перейшов на sealed структури для представлення помилок валідації. Ці насичені даними помилки (issues) дають UI достатньо контексту для рендеру, не змушуючи його думати чи щось обчислювати:
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
Тепер UI отримує всі необхідні деталі. Я усунув необхідність «полювання за контекстом» (decision context hunt) у UI-шарі, оскільки йому більше не потрібно знати деталі реалізації шару представлення чи обмеження домену.

Ще однією перевагою такого підходу є композиція валідаторів. Я можу використовувати спільні валідатори на різних екранах, або комбінувати їх з кастомними валідаторами під конкретний екран, коли бізнес-логіка відрізняється. Хтось може сказати, що це призводить до дублювання коду, але суворий SoC (як на рівні шарів, так і локально) завжди вартий цього компромісу. До того ж, я не думаю, що це великий боттлнек в епоху ШІ (хоча, чесно кажучи, навіть без нього це не займає багато часу).
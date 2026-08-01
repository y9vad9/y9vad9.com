---
title: Kotlin Coroutines — це не лише про конкурентність
preview: "Розбір примітивів, на яких побудовані корутини Kotlin, і того, де вони працюють поза асинхронним кодом — Sequence, DeepRecursiveScope та Jetpack Compose."
date: 2023-10-1
coverImage: "attachments/kotlin-coroutines-are-not-just-about-concurrency-cover.webp"
parents: ["Kotlin"]
---
Кожного разу, коли ви чуєте про Kotlin Coroutines, ви, ймовірно, думаєте про просте, лаконічне та продуктивне рішення для обробки асинхронних завдань, таких як, наприклад, мережеві запити. Але чи це їхня _єдина мета_? Розгляньмо використання Kotlin Coroutines за межами конкурентності.

## Примітиви Kotlin Coroutines
Почнемо з розуміння того, як працює основний механізм корутин. Якщо ми поглянемо на примітиви Kotlin Coroutines, ми побачимо лише кілька класів і функцій:
- `Continuation`
- `CoroutineContext`
- `suspendCoroutine`
- `createCoroutine`
- `startCoroutine`

Це все, що ми маємо в нашій `kotlin-stdlib`. Але для чого вони використовуються? Давайте заглибимося в те, як спроєктована робота Kotlin Coroutines.

### `Continuation`
Continuation — це просто інтерфейс з двома членами: `context` та `resumeWith`:
```kotlin
public interface Continuation<in T> {
    public val context: CoroutineContext
    public fun resumeWith(result: Result<T>)
}
```
Що він робить і яка його мета? `Continuation` — це буквально _Корутина_ в голому вигляді. Це як "прокачаний" колбек (callback) з можливістю передавати додаткову динамічну інформацію та надавати корисний результат виконання корутині.

Але так як ми ще не говорили про `CoroutineContext`, давайте почнемо з `resumeWith`.

### `resumeWith`
Як і будь-який інший колбек, це функція, яка викликається, коли корутина завершує свою роботу. Вона використовує [`kotlin.Result`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/) для безпечного поширення будь-яких винятків, що виникають всередині корутини.

Отже, ми можемо буквально створити нашу логіку конкурентності, використовуючи [`Continuation`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.coroutines/-continuation/) наступним чином:
```kotlin
suspend fun executeNetworkRequest(): String = 
	suspendCoroutine { continuation ->
		thread {
			continuation.resumeWith(someBlockingRequest())
		}
	}
```
> [`suspendCoroutine`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.coroutines/suspend-coroutine.html) — це міст між світом корутин та кодом, що не базується на корутинах.

Або використовувати існуючий асинхронний код (псевдокод):
```kotlin
suspend fun executeNetworkRequest(): String =
	suspendCoroutine { continuation ->
		apiService.getSomething()
			// onSuccess & onFailure — це колбек
			.onSuccess(continuation::resume)
			.onFailure(continuation::resumeWithException)
			.executeAsync()
	}
```
> `Continuation<in T>.resume(..)` — це розширення, щоб уникнути передачі `kotlin.Result` кожного разу.

Отже, ми можемо не лише реалізовувати нашу логіку конкурентності, але й використовувати існуючу та змусити її працювати з Kotlin Coroutines.

### `startCoroutine`
Також ми можемо запускати suspend-функції з non-suspend контекстів, використовуючи `startCoroutine`. У Kotlin це завжди використовується в кінці, якщо ваша функція `main` є `suspend`.

> `kotlinx.coroutines` використовує цей же механізм для запуску корутин, але логіка там, звісно, набагато складніша.

```kotlin
import kotlin.coroutines.*

fun main() {
	val operation: suspend () -> Unit = ::a
	operation.startCoroutine(
		object : Continuation<Unit> {
			// ми поговоримо про це нижче
			override val coroutineContext = EmptyCoroutineContext
			
			// викликається, коли корутина завершила свою роботу
			override fun resumeWith(result: Result<Unit>) {
				println(
					if(result.isSuccess) 
						"Successfully done" 
					else "Error happenned: ${result.exceptionOrNull()}"
				)
			}
		}
	)
}

suspend fun a() {...}
```
> Але, звісно, ви не можете просто викликати suspend-функції з `kotlinx.coroutines` при виконанні корутин таким чином — код, який орієнтується на `kotlinx.coroutines`, очікує деякі примітиви, які доступні лише при створенні корутин за допомогою цієї бібліотеки.

### `CoroutineContext`
Тепер ми підійшли до іншого члена `Continuation` — `CoroutineContext`. Для чого він?

`CoroutineContext` — це провайдер, який поширює необхідні дані в корутину. У реальному світі це зазвичай про передачу параметрів через складний ланцюжок корутин.
> Точніше кажучи, CoroutineContext у `kotlinx.coroutines` відповідає за [структуровану конкурентність (structured concurrency)](https://kotlinlang.org/docs/coroutines-basics.html#structured-concurrency).

#### Простий приклад
Давайте створимо з нашого попереднього прикладу для `startCoroutine` код з можливістю отримувати значення з `CoroutineContext`:
```kotlin
import kotlin.coroutines.*

// визначимо наш контейнер для даних, які нам потрібні всередині корутини
// він завжди повинен наслідувати 'CoroutineContext.Element'
data class ExecutionContext(val someInt: Int) : CoroutineContext.Element {
    override val key = EXECUTION_CONTEXT_KEY
}

// визначимо типобезпечний ключ, за допомогою якого ми отримаємо наше значення
val EXECUTION_CONTEXT_KEY = object : CoroutineContext.Key<ExecutionContext> {}

// визначимо контекст корутини, який ми передамо в Continuation
private val myCoroutineContext = object : CoroutineContext {
	private val values = mapOf<CoroutineContext.Key<*>, CoroutineContext.Element>(
        EXECUTION_CONTEXT_KEY to ExecutionContext(10000)
    )

	override operator fun <E : CoroutineContext.Element> get(key: CoroutineContext.Key<E>): E? {
		return values[key] as? E
	}

	// .. ми пропускаємо інші функції для простоти
}

suspend fun a() {
	// тут ми отримуємо значення з контексту корутини
	// coroutineContext — це вбудована властивість компілятора, яку можна викликати
	// тільки зі світу suspend
	val executionContext = coroutineContext[EXECUTION_CONTEXT_KEY]!!
	println(executionContext.someInt!!)
}

fun main() {
	val operation: suspend () -> Unit = ::a
	operation.startCoroutine(
		object : Continuation<Unit> {
			override val context: CoroutineContext = myCoroutineContext
			
			override fun resumeWith(result: Result<Unit>) {
				println(
					if(result.isSuccess) 
						"Successfully done" 
					else "Error happenned: ${result.exceptionOrNull()}"
				)
			}
		}
	)
}
```

> `CoroutineContext.Element` — це абстракція, яка використовується для зберігання елементів всередині `CoroutineContext`
>
> `CoroutineContext.Key` — це ідентифікатор `CoroutineContext.Element`.

Ви можете погратися з цим кодом [тут](https://pl.kotl.in/0AZBcZ4MM).

#### Приклад з реального проєкту

Уявімо, що у нас є наш API сервіс. Зазвичай нам потрібно мати певний шар (layer) авторизації, тож розглянемо наступний приклад (для цього я взяв gRPC):
```kotlin
// визначимо елемент, який буде зберігатися в `CoroutineContext`
data class AuthorizationContext(
    val accessHash: String?,
    val provider: AuthorizationProvider,
) : CoroutineContext.Element {
    companion object Key : CoroutineContext.Key<AuthorizationContext>

    override val key: CoroutineContext.Key<*> = Key
}

// тепер ми визначимо наш інтерцептор
class AuthorizationInterceptor(
    private val authorizationProvider: AuthorizationProvider,
) : CoroutineContextServerInterceptor() {
    companion object {
        private val ACCESS_TOKEN_METADATA_KEY: Metadata.Key<String> =
            Metadata.Key.of("access-token", Metadata.ASCII_STRING_MARSHALLER)
    }

    override fun coroutineContext(call: ServerCall<*, *>, headers: Metadata): CoroutineContext {
        return AuthorizationContext(
            accessHash = headers.get(ACCESS_TOKEN_METADATA_KEY),
            provider = authorizationProvider,
        )
    }
}
```

`CoroutineContext` у `kotlinx.coroutines` — це буквально просто `Map<K : CoroutineContext.Key, V : CoroutineContext.Element>` (якщо точніше, це [ConcurrentHashMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentHashMap.html) на JVM, наприклад), так само як це було в нашому прикладі вище. Але, якщо ми говоримо про `kotlinx.coroutines`, він поширюється на всі дочірні корутини в межах бажаної корутини (у нас не було такого механізму).

Отже, тепер ми можемо отримати його в дочірніх корутинах:
```kotlin
suspend inline fun provideAuthorization(block: (UserId) -> Unit) {
	val authContext = coroutineContext[AuthorizationContext]
	authContext.accessHash ?: throw StatusException(Status.UNAUTHORIZED)
	
	val userId = authContext.provider.provide(authContext.accessHash)
	return block(userId)
}
```

> Цікавий факт: [coroutineContext](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/coroutines/Continuation.kt#L157) — це єдина властивість у Kotlin, яка має модифікатор `suspend`. 👀

Для gRPC нам також потрібно зареєструвати наш Interceptor і написати наші RPC. Але ідея цього рішення для gRPC проста — відокремити логіку та спростити досвід розробника.

> Для Java gRPC використовує [ThreadLocal](https://docs.oracle.com/javase/8/docs/api/java/lang/ThreadLocal.html), тому ми також можемо розглядати `CoroutineContext` як альтернативу `ThreadLocal`. Ми не можемо використовувати `ThreadLocal` всередині корутин, тому що зазвичай корутина не прив'язана до конкретного потоку (особливо, коли ми говоримо про `withContext`). Корутини, швидше за все, будуть відновлені на іншому потоці (крім того, різні корутини можуть виконуватися на одному потоці).

Але чи не означає це, що єдина причина існування корутин — це конкурентність? Дозвольте пояснити.

## `Sequence`
Одним із найпоширеніших прикладів є — `kotlin.sequences.Sequence<T>`. Коротко кажучи, це ["лінива"](https://uk.wikipedia.org/wiki/%D0%9B%D1%96%D0%BD%D0%B8%D0%B2%D0%B0_%D1%96%D0%BD%D1%96%D1%86%D1%96%D0%B0%D0%BB%D1%96%D0%B7%D0%B0%D1%86%D1%96%D1%8F) колекція, яка ітерується лише тоді, коли ви починаєте споживати елементи. Ви можете прочитати про них більше [тут](https://kotlinlang.org/docs/sequences.html).

Якщо ви коли-небудь дивилися на вихідний код `SequenceScope`, він використовує suspend-функції "під капотом":
```kotlin
@RestrictSuspension
public abstract class SequenceScope<in T> internal constructor() {
    /**
     * Yields a value to the [Iterator] being built and suspends
     * until the next value is requested.
     */
    public abstract suspend fun yield(value: T)

    // ... other
}
```

> `@RestrictSuspension` забороняє споживачам викликати suspend-функції, які не є членами класу.

Отже, ідея полягає в тому, що елементи споживаються ліниво. Ви можете використовувати їх як звичайні колекції та користуватися перевагами лінивої ітерації.

Але як це працює всередині? Давайте поглянемо на вихідний код реалізації:
```kotlin
private typealias State = Int  
  
private const val State_NotReady: State = 0  
private const val State_ManyNotReady: State = 1  
private const val State_ManyReady: State = 2  
private const val State_Ready: State = 3  
private const val State_Done: State = 4  
private const val State_Failed: State = 5  
  
private class SequenceBuilderIterator<T> : SequenceScope<T>(), Iterator<T>, Continuation<Unit> {  
	private var state = State_NotReady  
	private var nextValue: T? = null  
	private var nextIterator: Iterator<T>? = null  
	var nextStep: Continuation<Unit>? = null  
  
	override fun hasNext(): Boolean {  
		while (true) {  
			when (state) {  
				State_NotReady -> {}  
				State_ManyNotReady ->  
				if (nextIterator!!.hasNext()) {  
					state = State_ManyReady  
					return true  
				} else {  
					nextIterator = null  
				}  
				State_Done -> return false  
				State_Ready, State_ManyReady -> return true  
				else -> throw exceptionalState()  
			}  
  
			state = State_Failed  
			val step = nextStep!!  
			nextStep = null  
			step.resume(Unit) // ВАЖЛИВО: це починає виконання наступного yield 
		}  
	}  
  
	override fun next(): T {  
		when (state) {  
			State_NotReady, State_ManyNotReady -> return nextNotReady()  
			State_ManyReady -> {  
				state = State_ManyNotReady  
				return nextIterator!!.next()  
			}  
			State_Ready -> {  
				state = State_NotReady  
				@Suppress("UNCHECKED_CAST")  
				val result = nextValue as T  
				nextValue = null  
				return result  
			}  
			else -> throw exceptionalState()  
		}  
	}  
  
	private fun nextNotReady(): T {  
		if (!hasNext()) throw NoSuchElementException() else return next()  
	}  
  
	private fun exceptionalState(): Throwable = when (state) {  
		State_Done -> NoSuchElementException()  
		State_Failed -> IllegalStateException("Iterator has failed.")  
		else -> IllegalStateException("Unexpected state of the iterator: $state")  
	}  
  
  
	override suspend fun yield(value: T) {  
		nextValue = value  
		state = State_Ready  
		return suspendCoroutineUninterceptedOrReturn { c ->  
			nextStep = c  
			COROUTINE_SUSPENDED  
		}  
	}    
	override fun resumeWith(result: Result<Unit>) {  
		result.getOrThrow() // просто повторно викидаємо виняток, якщо він є  
		state = State_Done  
	}  
  
	override val context: CoroutineContext  
		get() = EmptyCoroutineContext  
}
```

   > `COROUTINE_SUSPENDED` — це спеціальна константа, яка використовується внутрішньо компілятором Kotlin для управління призупиненням та відновленням корутин. Це не те, з чим розробники зазвичай взаємодіють безпосередньо, а скоріше служить внутрішнім сигналом у механізмі корутин.

Виглядає трохи складно для читання, чи не так? Давайте пройдемося крок за кроком:
1. Спочатку ми починаємо зі станів. У нас є наступні стани, поговоримо про них коротко:
	- **State_NotReady**: Ітератор не готовий надати елемент прямо зараз. Він може чекати на операцію або подальшу обробку, щоб зробити елемент доступним.
	- **State_ManyNotReady**: Ітератор готовий надати кілька елементів, але вони не готові негайно. Він чекає сигналу, що елементи готові для споживання (по суті, чекає термінального оператора).
	- **State_ManyReady**: Ітератор готовий надати кілька елементів прямо зараз. Він може негайно видати наступний елемент з послідовності.
	- **State_Ready**: Ітератор має один елемент, готовий до надання. Він налаштований негайно видати елемент при запиті.
	- **State_Done**: Ітератор більше не має елементів для надання. Він завершив свою роботу зі створення елементів з послідовності. Ми досягаємо цього стану, коли залишаємо `SequenceBuilder`.
	- **State_Failed**: Сталося щось несподіване, і ітератор зіткнувся з проблемою. Зазвичай це не повинно траплятися.
2. `hasNext` на основі стану повертає значення або набір значень, коли він готовий до споживання. Більше того, він починає виконання послідовності на кожній ітерації всередині `while`. Отже, якщо є `State_NotReady`, він робить його готовим, виконуючи наступні yield'и.
3. Функція `next` отримує наступний елемент з ітератора на основі його поточного стану (аналогічно до `hasNext`). Якщо `next` було викликано без `hasNext`, ви можете потрапити в `nextNotReady()`. В інших ситуаціях він просто поверне значення.
4. Функція `yield` просто змінює стани реалізації ітератора послідовності. Коли додаються нові елементи, він змінюється на `State_Ready`. Використання `suspendCoroutineUninterceptedOrReturn` призупиняє корутину (виконання) і відновлює її пізніше. Вона буде запущена, коли попередня корутина (точка призупинення) буде завершена.

Щоб завершити моє пояснення, давайте просто закінчимо тим, як ми могли б зробити ту ж функціональність, просто використовуючи колбеки:

```kotlin
val sequence = sequence {
    yield(1) {
        yield(2) {
            yield(3) { /* ... */ }
        }
    }
}
```

Але це виглядає трохи складно для читання, чи не так? Ось чому корутини корисні в цій конкретній ситуації.

Врешті-решт, це не виглядає так складно, чи не так?

## `DeepRecursiveScope`
Тепер обговоримо інший випадок використання Kotlin Coroutines — `DeepRecursiveScope`. Як ви, напевно, знаєте, зазвичай, коли конкретна функція викликає саму себе, у нас є ймовірність зіткнутися з `StackOverflowError`, оскільки кожен виклик додається до нашого стека.

> З тією ж метою, наприклад, також існує мовна конструкція `tailrec`. Різниця в тому, що `tailrec` не може мати розгалуження (умовні перевірки) з викликами інших функцій.
>
> Ви можете прочитати про це більше [тут](https://kotlinlang.org/docs/functions.html#tail-recursive-functions).

Отже, `DeepRecursiveScope` не покладається на традиційний потік стека, а використовує всі можливості, які пропонують корутини. Щоб зрозуміти це краще, розглянемо класичний приклад з числами Фібоначчі:
```kotlin
val fibonacci = DeepRecursiveFunction<Int, Int> { x ->
    when {
        x < 0 -> 0
        x == 1 -> 1
        else -> callRecursive(x - 1) + callRecursive(x - 2)
    }
}

println(fibonacci(12)) // вивід: 144
```

Для більш складного прикладу ви можете звернутися до [kdoc](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/util/DeepRecursive.kt#L40).

Ми не будемо зупинятися на точних деталях реалізації `DeepRecursiveScope` (ви можете поглянути на це [тут](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/util/DeepRecursive.kt#L131)), оскільки він має ту ж ідею, що й `Sequence` з додатковою поведінкою для підтримки механізмів, що надаються, але давайте обговоримо, як Kotlin Coroutines вирішують цю конкретну проблему. Крім того, є [дуже хороша стаття про це](https://elizarov.medium.com/deep-recursion-with-coroutines-7c53e15993e3) від Романа Єлізарова.

### Корутини всередині
Як саме це вирішує проблему? Як я вже згадував раніше, корутини натхненні [CPS (Continuation Passing Style)](https://en.wikipedia.org/wiki/Continuation-passing_style), але це не зовсім те, що робить компілятор Kotlin для ефективної обробки корутин.

Компілятор Kotlin використовує комбінацію оптимізацій для ефективного управління стеком корутин та виконанням. Давайте перевіримо, що саме він робить:
- **Трансформації компілятора**: Компілятор Kotlin генерує машину станів (State Machine), подібну до тієї, що ми бачили в деталях реалізації [Sequences](#Sequence). Це не позбавляє від усіх викликів стека, але зменшує їх достатньо, щоб не зіткнутися з `StackOverflowError`.
- **Виділення пам'яті для Continuations в кучі (Heap-Allocation)**: У традиційному ланцюжку колбеків кожен виклик функції додає дані до стека викликів. Якщо ланцюжок глибокий, це може споживати багато місця в стеку. У підході з корутинами, коли корутина призупиняється, її continuation зберігається в кучі (heap) як об'єкт. Цей об'єкт continuation містить необхідну інформацію (стек, диспетчер тощо) для відновлення виконання корутини. Це зберігання в кучі дозволяє мати значно більшу місткість для обробки глибоких ланцюжків викликів без ризику переповнення стека.

Точний механізм корутин наступний:
1. **Серіалізація**: Стан стека призупиненої корутини зберігається в об'єкті continuation, виділеному в кучі.
2. **Відновлення**: Коли корутина готова до відновлення, фреймворк налаштовує нативний стек, щоб імітувати захоплений стан.
3. **Копіювання пам'яті**: Серіалізований стан стека копіюється з об'єкта continuation в нативний стек.
4. **Конфігурація контексту**: Контекст виконання налаштовується відповідно до початкового стану.
5. **Лічильник команд (Program Counter)**: Лічильник команд встановлюється на збережене значення для правильної інструкції.
6. **Виклик**: Код continuation викликається за допомогою CPS, відновлюючи виконання.

> Відновлення стека також допомагає нам з відновленням на різних потоках, оскільки вони нічого не знають про стек нашої корутини.

Отже, відтепер ми можемо зрозуміти, як корутини працюють зсередини. Давайте перейдемо до інших прикладів, де корутини Kotlin використовуються за межами конкурентності.

## Jetpack Compose
Якщо ви коли-небудь працювали з Compose і, наприклад, обробляли події вказівника (pointer events), ви, ймовірно, помічали, що для прослуховування оновлень використовуються деякі хаки з Coroutines:
```kotlin
@RestrictsSuspension // <---
@JvmDefaultWithCompatibility
interface AwaitPointerEventScope : Density {
	// ...
	
	suspend fun awaitPointerEvent(
        pass: PointerEventPass = PointerEventPass.Main
    ): PointerEvent
    
	suspend fun <T> withTimeoutOrNull(
        timeMillis: Long,
        block: suspend AwaitPointerEventScope.() -> T
    ): T? = block()
    
	suspend fun <T> withTimeout(
        timeMillis: Long,
        block: suspend AwaitPointerEventScope.() -> T
    ): T = block()
    
	// ...
}
```
Отже, як ви бачите, scope, який використовується для обробки подій вказівника, позначений `@RestrictsSuspension`. Якщо ми звернемося до наданої документації, ми побачимо наступне:
```markdown
This is a restricted suspension scope. Code in this scope is
always called un-dispatched and may only suspend for calls 
to [awaitPointerEvent]. These functions resume synchronously and the caller may mutate the result
**before** the next await call to affect the next stage of the input processing pipeline.
```

`awaitPointerEvent` обробляється за допомогою примітивів kotlin, без `kotlinx.coroutines`. Оскільки в такій ситуації нам не потрібна логіка `kotlinx.coroutines` (це просто колбек, який викликається з потоку Main-looper після дії користувача).

## Висновок
На завершення, ця стаття дослідила різні аспекти Kotlin Coroutines, підкреслюючи їх універсальність за межами традиційних завдань конкурентності. Ми заглибилися у внутрішню роботу примітивів корутин, обговорили їх використання в Sequences та вирішення складних проблем, таких як глибока рекурсія, і розглянули приклади з реального світу, які демонструють їх широке застосування. Назва "Coroutines — це не лише про конкурентність" влучно відображає різноманітні можливості, які пропонують корутини Kotlin у сучасній розробці програмного забезпечення.

Не соромтеся невимушено поділитися своїм досвідом у розмові біля кулера!

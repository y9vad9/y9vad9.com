---
date: 2022-11-22
title: "Kotlin для початківців: Структури даних — Null-safety"
preview: "Дізнаємося, як Kotlin бореться з помилкою на мільярд доларів. nullable типи, Smart cast, Safe call, Elvis-оператор та Double-bang."
series: "Kotlin для початківців"
order: 18
next: "kotlin-for-beginners-exceptions"
parents: ["Kotlin для початківців"]
archived: true
---

# Nullable типи
Ми розглянули об'єкти й тепер прийшов час розглянути випадки, коли у нас можуть бути відсутні якісь дані.
Що таке nullable? **Nullable** – це властивість типу не обов'язково мати значення, а дозволяти `null` (ніщо).

```kotlin
val string: String? = null
```
Як ми бачимо, у нас додався знак питання `?` після типу, і тепер значення може дорівнювати `null`.

> **💡 Цікаво знати** <br/>
> В багатьох мовах програмування ви можете отримати помилку прямо під час роботи програми, якщо забудете перевірити, чи є дані. Це називають "помилкою на мільярд доларів". Kotlin змушує вас перевіряти такі змінні ще на етапі написання коду.

## Null-safety
Kotlin зобов'язує перевіряти nullable типи перед використанням. Наприклад, ви не можете просто присвоїти `String?` змінній типу `String`:
```kotlin
fun main() {
    val string: String = someFunction() // Помилка: Type mismatch
}

fun someFunction(): String? = null
```

### Smart cast (Розумне приведення)
Найпростіший спосіб — звичайна перевірка через `if`. Якщо ми перевірили, що об'єкт не `null`, Kotlin дозволяє працювати з ним як зі звичайним типом.

```kotlin
val foo: String? = getFooOrNull()
if (foo != null) {
    println(foo.length) // Тут foo вже типу String (не nullable)
}
```

> **💡 До речі** <br/>
> Функції, що можуть повернути "ніщо", зазвичай називають за шаблоном `getXOrNull()`, щоб це було очевидно для розробника.

### Safe call (Безпечний виклик) `?.`
Якщо об'єкт зліва від `?.` дорівнює `null`, то весь вираз поверне `null`, а код справа не буде виконуватись.

```kotlin
val foo: String? = getFooOrNull()
println(foo?.plus("Bar")) // Виведе null, якщо foo було null
```

### Elvis-оператор `?:`
Дозволяє вказати значення за замовчуванням, якщо вираз зліва повернув `null`.

```kotlin
val foo: String? = getFooOrNull()
println(foo?.plus("Bar") ?: "Немає даних")
```
Ви також можете використовувати його для виходу з функції:
```kotlin
val foo: String? = getFooOrNull() ?: return
```

### Not-null assertion `!!` (Double-bang)
Ви кажете компілятору: "Я точно впевнений, що тут не null".

```kotlin
val foo: String? = "abc"
println(foo!!.length) 
```

> **⚠️ Увага** <br/>
> Використовуйте `!!` дуже обережно. Якщо там все ж таки виявиться `null`, ваша програма негайно аварійно завершиться.

> **💡 Лайфхак** <br/>
> Оскільки значення `var` може змінитись у будь-який момент (наприклад, іншим потоком), смарт-касти для них не працюють. Найкраще створити локальну копію через `val`:
> ```kotlin
> val localString = globalString ?: return
> println(localString) // Тепер localString — це звичайна String
> ```
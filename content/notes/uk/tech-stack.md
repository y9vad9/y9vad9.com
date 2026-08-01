---
title: Стек
preview: "Мови та інструменти, з якими я реально працював: Kotlin, Java, PHP, Python, TypeScript — і що з кожного вийшло."
parents: ["Про мене"]
---

## Kotlin (Prod)
Kotlin — моя основна мова з 2020 року. Спершу це була просто альтернатива Java для Android, але дуже швидко він
став моїм стандартом для всього — від серверних служб до мультиплатформних проєктів. Навіть сайт, який ви зараз читаєте,
написаний на ньому. Кожен проєкт із 2021 року так чи інакше спирався на гнучкість і лаконічність Kotlin.

### Стек
- kotlinx.coroutines (Flow тощо), RxJava (спочатку переважно).
- kotlinx.serialization, Gson (спочатку переважно), Moshi.
- Ktor, OkHttp, Retrofit, Fuel, Okio (спочатку переважно)
- [RSocket](https://github.com/timemates/sdk), [gRPC](https://github.com/timemates/sdk), Rest

### Android
#### Архітектури
- MVP
- [MVI](https://github.com/y9vad9/cadento)
- [MVVM](https://github.com/y9vad9/contacts-app)

#### Дизайн
- XML (з ViewBinding / DataBinding)
- [Jetpack Compose](https://github.com/y9vad9/cadento) (Material2 + Material3) (переважно)
    - Бібліотеки Accompanist
#### Бібліотеки
- Room, SQLDelight
- Picasso, Glide, Coil
- Firebase
- Admob
- Android Lifecycle (ViewModel тощо)

Приклади використання деяких бібліотек — [тут](https://github.com/y9vad9/simple-vocabulary).
### Мультиплатформа
- [Compose Multiplatform](https://github.com/y9vad9/cadento)
- [SQLDelight](https://github.com/y9vad9/cadento)
- [Decompose](https://github.com/y9vad9/cadento)

## Java
Java лишається частиною мого фундаменту, хоча тепер я беруся за неї нечасто. Останній великий проєкт на ній робив для університету — [Telegram-бот](https://github.com/y9vad9/restaurant-coursework). До того писав на ній різні речі, зокрема [Sketchcode](sketchcode).

Kotlin мені підходить більше, але за оновленнями Java я все одно стежу — це як старий друг, з яким бачишся нечасто, але зв'язку не втрачаєш.

Те саме, що й з досвідом Kotlin. Писав на ній раніше.

## PHP
Моє перше програмістське кохання. Саме з PHP я вперше відчув кайф від того, що щось будуєш. Я давно пішов далі, але поважаю, як мова розвивалася. На PHP працював мій перший великий проєкт, _Sketchcode_ — звідти безцінний досвід оптимізації та масштабування.

Стек:
- Laravel
- Json, XML
- тощо

Найчастіше писав на чистому PHP — нескладні CRUD.

## Python
З Python я знайомий поверхово — пишу скрипти, роблю невеликі пет-проєкти та допомагаю другу з коледжу розібратися з основами.
Цікавий факт: тепер той друг не визнає нічого, крім Kotlin. Завдяки мені.

## TypeScript (Prod)
TypeScript у моєму наборі з'явився пізніше — під час [rrpc](https://github.com/timemates/rrpc-ts), проєкту для генерації RPC-сервісів поверх RSocket.

Крім того, зараз пишу на ньому щодня — для [робочих завдань](experience).

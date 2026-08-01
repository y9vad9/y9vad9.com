---
title: Tech-Stack
preview: "Die Sprachen und Werkzeuge, mit denen ich tatsächlich gearbeitet habe: Kotlin, Java, PHP, Python, TypeScript — und was jeweils daraus geworden ist."
parents: ["Zusammenfassung"]
---

## Kotlin (Produktion)
Kotlin ist seit 2020 meine bevorzugte Sprache. Was als Alternative zu Java für die Android-Entwicklung begann, entwickelte sich schnell
zu meinem Standard für alles, von Backend-Diensten bis hin zu Multiplattform-Projekten. Sogar die Website, die Sie gerade besuchen,
wurde damit erstellt. Jedes Projekt, an dem ich seit 2021 gearbeitet habe, hat die Flexibilität und Prägnanz von Kotlin genutzt.

### Stack
- kotlinx.coroutines (Flow, etc.), RxJava (zuerst bevorzugt).
- kotlinx.serialization, Gson (zuerst bevorzugt), Moshi.
- Ktor, OkHttp, Retrofit, Fuel, Okio (zuerst bevorzugt)
- [RSocket](https://github.com/timemates/sdk), [gRPC](https://github.com/timemates/sdk), Rest

### Android
#### Softwaredesign
- MVP
- [MVI](https://github.com/y9vad9/cadento)
- [MVVM](https://github.com/y9vad9/contacts-app)

#### Design
- XML (mit ViewBinding / DataBinding)
- [Jetpack Compose](https://github.com/y9vad9/cadento) (Material2 + Material3) (bevorzugt)
    - Accompanist-Bibliotheken
#### Bibliotheken
- Room, SQLDelight
- Picasso, Glide, Coil
- Firebase
- Admob
- Android Lifecycle (ViewModel, etc.)

Die Verwendung einiger Bibliotheken können Sie [hier](https://github.com/y9vad9/simple-vocabulary) überprüfen.
### Multiplattform
- [Compose Multiplatform](https://github.com/y9vad9/cadento)
- [SQLDelight](https://github.com/y9vad9/cadento)
- [Decompose](https://github.com/y9vad9/cadento)

## Java
Java hat einen festen Platz in meiner Grundlage, obwohl ich es jetzt nicht mehr so oft verwende. Mein letztes großes Projekt war für eine Universität – ein [Telegram-Bot](https://github.com/y9vad9/restaurant-coursework). Davor habe ich es für verschiedene andere Projekte verwendet, wie zum Beispiel [Sketchcode](sketchcode).

Obwohl Kotlin besser zu meinen Bedürfnissen passt, verfolge ich immer noch die Updates von Java – es ist wie ein alter Freund, den man nicht oft sieht, aber nie den Kontakt verliert.

Dasselbe gilt für die Kotlin-Erfahrung. Ich habe es früher benutzt.

## PHP
Meine erste Programmierliebe. PHP war, wie ich die Freude am Bauen entdeckte. Obwohl ich weitergezogen bin, respektiere ich, wie sich die Sprache entwickelt hat. Es betrieb mein erstes großes Projekt, _Sketchcode_, und gab mir unschätzbare Erfahrungen in Optimierung und Skalierbarkeit.

Stack:
- Laravel
- Json, XML
- etc.

Meistens habe ich reines PHP verwendet, um nicht komplexe CRUDs zu schreiben.

## Python
Ich habe nur an der Oberfläche von Python gekratzt – Skripte geschrieben, kleine Haustierprojekte gebaut und einem Studienfreund geholfen, die Grundlagen zu lernen.
Lustige Tatsache: Dieser Freund schwört jetzt auf Kotlin, dank mir.

## TypeScript (Produktion)
Eine neuere Ergänzung meines Toolkits, TypeScript kam bei [rrpc](https://github.com/timemates/rrpc-ts) ins Spiel, einem Projekt zur Generierung von RPC-Diensten mit RSocket.

Zusätzlich dazu verwende ich es derzeit täglich für meine [Arbeitsaufgaben](experience).

---
title: Fehlschläge, die wir nicht korrekt modellieren
preview: "Warum das Zurückgeben von null, das Werfen von Exceptions oder das Wrappen in Result keine bloße Stilfrage ist – es ist ein Vertrag, den du definierst."
date: 2025-12-29
coverImage: "attachments/contract-violation-handling-cover.webp"
parents: ["Kotlin", "Softwaredesign"]
---

Guards, Validierung, Error Handling – wir alle machen das. Wir werfen Exceptions, geben null zurück, verpacken (wrappen) Werte in ein Result oder vertrauen einfach darauf, dass der Aufrufer "das Richtige tut". Meistens denken wir gar nicht darüber nach – wir folgen bekannten Mustern und machen weiter.

Gleichzeitig gibt es eine ständige Spannung:
- "Exceptions sind schlecht"
- "Das sollte exception-free sein"
- "Wir müssen alle Fehler explizit behandeln"

Aber was bedeutet das eigentlich?

Nicht jeder Fehlschlag ist ein Fehler. Nicht jede Exception ist außergewöhnlich. Und nicht jede unsichere Operation verdient es, gewrappt zu werden, nur um sich sicherer zu fühlen. Womit wir es wirklich zu tun haben, ist etwas viel Fundamentaleres: Verletzungen von Contracts (Verträgen) zwischen Teilen unseres Programms.

Eine Funktion trifft Annahmen über ihren Input. Ein Aufrufer trifft Annahmen über das Ergebnis. IO nimmt an, dass sich die Welt adäquat verhält. Früher oder später brechen diese Annahmen.

Kotlin gibt uns viele Möglichkeiten, dieses "Etwas" auszudrücken: werfen (throwing), null zurückgeben, unsichere Operationen exponieren, Results wrappen oder Aufrufer zwingen, Fehler durch Typen anzuerkennen. Nichts davon ist universell richtig oder falsch – aber jedes davon kommuniziert Verantwortung auf eine andere Weise.

In diesem Artikel geht es nicht darum, Exceptions zu verbannen oder Typen zu vergöttern. Es geht darum zu verstehen, welchen Contract du definierst, wem seine Verletzung "gehört" und wie explizit deine API sein sollte.

## Was ist ein Contract?
Beginnen wir mit der Definition dessen, was wir unter einem Contract verstehen:

Ein **Contract** ist eine Vereinbarung zwischen einer Funktion und ihrem Aufrufer (Caller), die definiert, welche Inputs erlaubt sind, welches Ergebnis garantiert wird, wenn diese Inputs valide sind, und was passiert, wenn diese Erwartungen verletzt werden. Er beschreibt die Annahmen, die eine Funktion trifft, die Versprechen, die sie im Gegenzug gibt, und wie ein Fehlschlag ausgedrückt wird, wenn diese Annahmen nicht zutreffen.

Wir können einen Contract in drei Hauptpunkte unterteilen:
1. **Vorbedingungen (Preconditions)**: Welche Bedingungen der Aufrufer vor einem Aufruf einhalten muss. Zum Beispiel erwartet `List<E>.first()` aus der Standardbibliothek, dass du prüfst oder sicher bist, dass `List<E>` mindestens ein Element enthält.
2. **Nachbedingungen (Postconditions)**: Was der Aufgerufene im Gegenzug garantiert. Um auf das vorherige Beispiel zurückzukommen: `List<E>.first()` garantiert, dass es bei einer nicht-leeren Liste das erste Element zurückgibt.
3. **Fehlersemantik (Failure semantics)**: Was passiert, wenn der Contract verletzt wird (Funktion wirft eine Exception, Funktion gibt null / type-safe Result zurück oder beendet einfach das gesamte Programm).

Es ist wichtig zu verstehen, dass es bei einem Contract nicht um Validierung wie `require(...)` oder `check(...)` in deinem Code geht, sondern eher um die Definition, **was erlaubt ist, was versprochen wird und wer schuld ist, wenn es schiefgeht**. Manchmal hast du vielleicht gar keine Validierung (was man besser vermeiden sollte; [Fail-Fast](https://de.wikipedia.org/wiki/Fail-Fast) ist immer noch relevant), aber das lässt das "Contract"-Konzept nicht magisch verschwinden.

### Arten der Contract Violation
Da es in diesem Artikel vor allem um den Umgang mit Contract Violations geht, lass uns über verschiedene Arten von Contract Violations sprechen.

#### Benutzereingabe (User Input)
Benutzereingaben sind die offensichtlichste und meistdiskutierte Quelle für Contract Violations – und das aus gutem Grund. Benutzer sind nicht Teil deines Programms. Sie kennen deine Invarianten nicht, respektieren deine Einschränkungen nicht und werden fröhlich Input liefern, der jede Annahme verletzt, die dein Code möglicherweise machen könnte.

In diesem Fall sind Contract Violations **erwartet**, **häufig** und **nicht außergewöhnlich**. Ein leeres Feld, eine ungültige E-Mail, eine negative Zahl, wo nur positive Werte Sinn ergeben – nichts davon ist überraschend. Es ist Teil des normalen Control Flows.
Deshalb ist User Input normalerweise der Ort, an dem wir:
- "eager" (gierig) validieren,
- Fehler explizit melden,
- und Throwing vermeiden, wann immer möglich.

Hier bedeutet das Werfen einer Exception oft, dass _du die Kontrolle verloren hast_. Der Contract wurde verletzt, aber die Verletzung war vorhersehbar, und deine API sollte diese Realität widerspiegeln. Einen typisierten Fehler, ein Validierungsergebnis oder einen Failure-Wert zurückzugeben, ist normalerweise das Ehrlichste, was man tun kann.

Der wichtige Teil ist Ownership: **Der Aufrufer "besitzt" die Violation**. Der Benutzer hat den Contract gebrochen, nicht das System.

#### Programmierfehler (Programmer Error)
Programmierfehler leben in einer anderen Realität. Das sind interne Fehler (Logik-Bugs), die normalerweise zu Exceptions führen. Im Gegensatz zu User Input, der zeitweise ungültig sein kann, deuten Programmierfehler darauf hin, dass etwas **innerhalb deines Programms** schiefgelaufen ist, und du behandelst sie normalerweise **nicht stillschweigend**.

Angenommen, du hast eine Funktion, die **die Breite einer View** setzt, und sie wirft eine Exception, wenn die Breite negativ ist:
```kotlin
fun setWidthPx(view: View, widthPx: Int) {
    require(widthPx >= 0) { "Width must be non-negative" }
    view.layoutParams = view.layoutParams.apply { this.width = widthPx }
}
```
Stell dir nun einen Aufrufer vor, der eine Breite berechnet, aber **vergisst, einen Edge Case zu behandeln**:
```kotlin
val parentWidth = parent.measuredWidth
val padding = 20
val desiredWidth = parentWidth - padding * 2  // hoppla, parentWidth ist kleiner als padding * 2
setWidthPx(myView, desiredWidth) // 💥 throws: Width must be non-negative
```

Die Funktion ist korrekt, der Aufrufer ist "normal", aber der Contract ist verletzt. Das ist **ein echter Programmierfehler**, und das ist nichts, wovon dein Programm versuchen sollte, sich stillschweigend zu erholen – außer indem man solche Fehler gar nicht erst macht.

#### Umgebungsfehler (Environmental failure)
Umgebungsfehler sind ein ganz anderes Kaliber. Diese kommen von Dingen, **die du nicht kontrollierst**, wie das Dateisystem, Netzwerk oder Hardware. Im Gegensatz zu Programmierfehlern garantiert keine noch so perfekte interne Logik Erfolg. Selbst mit makellosem Code können diese Operationen **immer noch fehlschlagen** – und deshalb brauchen sie explizite Behandlung.

Und selbst dann bedeutet das **nicht, dass wir unseren Code überkomplizieren sollten** oder so tun, als gäbe es diese Fehler nicht. Das Ziel ist nicht, alles in Schichten von Typen oder defensiven Checks zu wrappen – es ist, **das Unvermeidliche explizit, klar und am richtigen Ort** zu behandeln.

## Wie geht man mit Contract Violations um?
Da wir nun die Arten von Contract Violations besprochen haben, ist es Zeit, die Wege zu diskutieren, wie wir Risiken, die unseren Code brechen könnten, am besten mitigieren können.

### Wie wird es im Code behandelt, den wir nutzen?
Fangen wir mit Beispielen an, die wir täglich sehen.

#### Standard Library
kotlin-stdlib ist etwas, wovon sich viele Entwickler inspirieren lassen, wenn sie ihre eigenen APIs bauen. Und kein Wunder – sie führte eine Reihe von Mustern ein, die still und leise geprägt haben, wie wir heute Kotlin schreiben.

Fangen wir mit Funktionen an, die im Fall einer Contract Violation **Exceptions werfen**:
- [`kotlin.Result<T>.getOrThrow()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/get-or-throw.html) wirft eine gekapselte `Exception`, falls das Ergebnis nicht erfolgreich war. Es wird erwartet, dass du dir über das Ergebnis absolut sicher bist, indem du `isSuccess()` vor dem Aufruf prüfst.
- [`String.toInt()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int.html) wirft `NumberFormatException`, falls der String keine valide Zahl war. Es wird erwartet, dass du den String vorher prüfst, dir über den Input sicher bist oder eine andere Variante der Funktion nutzt, die wir gleich besprechen.
- `Iterable<Int>.max`/`min`/`first`/`last`() werfen [`NoSuchElementException`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/collections/-no-such-element-exception/index.html), falls das gegebene Iterable keine Elemente hatte.

Alle diese APIs verlassen sich auf **dein Wissen über den Zustand, den du übergibst**. Wenn sich dieses Wissen als falsch herausstellt, werfen sie. Laut und sofort.

Aber Throwing ist nicht die einzige Option. Für die meisten dieser Funktionen bietet die Standardbibliothek auch OrNull-Varianten an, die explizit signalisieren, dass ein Fehlschlag ein _mögliches und erwartetes Ergebnis_ ist:
- [`Result<T>.getOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/get-or-null.html)
- [`String.toIntOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)
- [`Iterable<Int>.maxOrNull()`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-or-null.html)

Hier ist der Contract anders: _Du weißt es nicht sicher_, also zwingt dich die API, mit der Abwesenheit eines Wertes umzugehen.

Ein etwas weniger diskutiertes Muster ist `OrElse`, das diese Verantwortung noch weiter an die Aufrufstelle (Call Site) schiebt:
```kotlin
val items = listOf("a", "b", "c")

val value = items.elementAtOrElse(5) { index ->
    "<missing at $index>"
}
```

Anstatt zu werfen oder null zurückzugeben, bittet dich die Funktion, **den Fallback explizit zu definieren**.

Diese drei Muster – OrThrow, OrNull und OrElse – bilden das Rückgrat des Ansatzes der Standardbibliothek zu Contract Violations. Kotlin zwingt dich nicht in eine einzelne "richtige" Strategie. Stattdessen gibt es dir mehrere Wege auszudrücken, **wie sicher du bist**, **wem der Fehler gehört** und **wie explizit du deine API haben willst**.

#### kotlinx.coroutines
`kotlinx.coroutines` sind nicht viel anders, und das ist auch kein Wunder – sie wurden ebenfalls vom Kotlin-Team gemacht.

Wir können die gleichen Muster sehen, sowie einige andere:
- [`Deferred<T>.getCompletionExceptionOrNull(): T?`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completion-exception-or-null.html) gibt null zurück, wenn der Abschluss nicht exzeptionell war.
- [`Deferred.getCompleted()`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completed.html) wirft `IllegalStateException`, wenn `Deferred<T>` zum Zeitpunkt des Aufrufs nicht abgeschlossen war.
- [`SendChannel.trySend(value: T)`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-send-channel/try-send.html): [`ChannelResult<T>`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-channel-result/)
- [`MutableSharedFlow.trySend(value: T)`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-shared-flow/try-emit.html): [`Boolean`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-boolean/)

Wie wir sehen können, gibt es ein weiteres Muster, das `try` vor sein reguläres Gegenstück stellt – zum Beispiel `trySend`. In `kotlinx.coroutines` existiert dieses Muster, um einen exception-basierten Contract in einen expliziten, value-basierten zu verwandeln.

Die originale Funktion signalisiert Fehlschlag durch Throwing. Die `try*`-Variante bewahrt die gleiche Operation, gibt aber stattdessen ein sinnvolles Ergebnis zurück, was dem Aufrufer erlaubt, den Fehlschlag zu behandeln, ohne sich auf Exceptions oder try/catch zu verlassen.

_______
Das sind die Hauptmuster, die du in Kotlins offiziellen Bibliotheken finden wirst. Der interessante Teil beginnt, wenn du eines auswählen musst.

Diese Wahl hat selten etwas mit persönlichem Geschmack oder "Exceptions vs Types" zu tun. Es geht darum, welche Art von Fehler du modellierst, wem er gehört und was der Aufrufer wissen oder garantieren soll.

Ist ein Fehlschlag Teil des normalen Control Flows, oder deutet er auf eine gebrochene Annahme hin?
Wird vom Aufrufer erwartet, dass er sich erholt, oder ist dies ein Punkt, an dem das Programm aufhören sollte so zu tun, als ob alles in Ordnung wäre?
Überquert diese Operation eine Systemgrenze, oder bleibt sie vollständig innerhalb von vertrauenswürdigem Code?

Die Beantwortung dieser Fragen macht das Muster normalerweise offensichtlich: Throwing, `OrNull`, `OrElse` oder `try*` hört auf, eine stilistische Wahl zu sein und wird Teil des Contracts, den du definierst.

### Realität
Die wirkliche Frage ist nicht, welche Muster existieren, sondern wo du die Linie ziehst.

In der Praxis "fehlen" die meisten Codebases nicht überall gleichmäßig. Sie fehlschlagen an Grenzen (Boundaries).

#### Benutzereingabe (User Input)
Benutzereingabe ist eine solche Grenze. Wir erwarten ungültige Daten, also ist Throwing normalerweise das falsche Signal. Eine "Exception" dort kommuniziert keinen Bug – es bedeutet nur, dass der Benutzer etwas Komisches getippt hat. Deshalb tendieren APIs an dieser Kante natürlich zu type-safe Ergebnissen: Sie machen den Fehlschlag explizit, erwartet und lokal.

An dieser Grenze sollten wir unseren Fokus von exception-first auf safe-first verschieben:
```kotlin
@JvmInline
value class UserName private constructor(val rawString: String) {
	companion object {
		fun create(value: String): FactoryResult {
			return if (value.length !in 2..50) FactoryResult.InvalidLength else FactoryResult.Success(UserName(value))
		}
	}
	
	sealed interface FactoryResult {
		data object InvalidLength : FactoryResult
		data class Success(val value: UserName) : FactoryResult
	}
}
```
Was... unserem zuvor etablierten Muster direkt widerspricht. Aber ist es schlecht?

Muster wie standardmäßiges Exception-Werfen und dann `OrNull` oder `try*` zu haben sind gut – _wenn sie anwendbar sind_. Die Kotlin Standardbibliothek ist eine General-Purpose-Bibliothek und wurde ohne unseren Kontext im Hinterkopf entworfen. Indem wir das Muster hier brechen, riskieren wir nichts: Das Typsystem beschützt uns.

Aber bedeutet das, dass jeder Input überall als gleich unzuverlässig behandelt werden sollte und wir Muster, die zuvor besprochen wurden, entmutigen sollten? Nein.

Ein einfaches Gegenbeispiel ist die Datenbank. Wenn Daten aus der Datenbank kommen, signalisieren ungültige Werte normalerweise einen Bug eher als einen typischen Benutzerfehler. Da sie vorher validiert sein sollten.

Deshalb führen wir oft eine unsichere (unsafe) Variante ein, die unser type-safe Ergebnis absichtlich unsicher _umgeht_:
```kotlin
@JvmInline
value class UserName private constructor(val rawString: String) {
	companion object {
		// ...
		fun createOrThrow(value: String): UserName {
			return if (value.length !in 2..50) throw IllegalArgumentException(...)
			else UserName(...)
		}
	}
	// ...
}
```

Es hat immer noch einen vertrauten Kotlin Standard Library Beigeschmack, eng ausgerichtet an Funktionen wie `Result<T>.getOrThrow()`, die wir nur aufrufen, wenn wir zuversichtlich sind, dass das Ergebnis erfolgreich sein _muss_ – und alles andere auf einen Bug hindeuten würde.

Wir zwingen `create` nicht zum Werfen, noch versuchen wir `try*`, standardmäßig eine type-safe Variante zurückzugeben – **wir sind keine generische Bibliothek wie Kotlin Standard Library oder kotlinx.coroutines**, die ihre Zielverwendung nicht kennt. Wir wissen, was wir erwarten, und in unserem Fall ist jede extra Variante eine _extra Wahl_ – und per Definition ist jede extra Wahl eine Gelegenheit, sie falsch zu verwenden. `create` ist die primäre Funktion: Sie erscheint zuerst in der Code-Completion, sie ist das Erste, wonach Entwickler greifen, und sie setzt die Erwartung von sicherem Handling.

#### Interner Input (Internal Input)
Auch wenn der meiste Einfluss auf unser System von Benutzern kommt, bedeutet das nicht, dass wir safe-first Muster überall anwenden oder blind jeden Systemaufruf mit `OrThrow` wrappen müssen. Das wäre Overkill.

Für Daten, deren Lebenszyklus **vollständig dem System gehört**, ist es völlig in Ordnung, bei ungültigen Werten sofort zu werfen. Wenn hier ein Contract verletzt wird, ist es ein Bug – und wir wollen so schnell wie möglich davon wissen. Wir brauchen keine zusätzlichen Sicherheitsschichten für etwas, das wir vollständig kontrollieren. Zum Beispiel:
```kotlin
@JvmInline
value class ConfirmationAttempts(val rawInt: Int) {
	init {
		require(rawInt > 0) { "Confirmation attempts cannot be negative." }
	}
}
```
Bei `ConfirmationAttempts` ist es ziemlich logisch zu wissen, dass Bestätigungsversuche nicht negativ sein können – sein Contract ist allein durch die Benennung wohl etabliert. Du _könntest_ es technisch in `createOrThrow` wrappen, wenn du willst, aber ich mache das normalerweise nicht – denn wenn jeder systemeigene Wert so gewrappt wird, geht das "Achtungssignal", das `OrThrow` vermittelt, verloren – besonders wenn alles, was wirft, so ein Signal hat. Es wird zu Hintergrundrauschen: Effektiv ist es dasselbe, wie einfach ein require in den init-Block zu setzen, und niemand bemerkt es mehr.

Das macht die zuvor besprochenen Muster aus der Standardbibliothek und `kotlinx.coroutines` nicht obsolet. Wir nutzen sie aus dem gleichen Grund wie diese Bibliotheken – wenn wir nicht sicher sind, an welcher Grenze es verwendet wird – ist es eine Benutzereingabe? Oder ist es eine vertrauenswürdige Grenze, wo Fehler nicht passieren sollten?

Das Prinzip ist einfach: `OrThrow` ist ein Weg, Ergebnisse unsicher zu konsumieren, kein Default zum Markieren von Code, der werfen kann.

#### Unkontrollierter Input (Uncontrolled Input)
Nicht alle Daten kommen ordentlich verpackt als "Benutzereingabe" oder "Systemeigentum". Manchmal haben wir es mit Quellen zu tun, die weder vollständig vertrauenswürdig noch vollständig unter unserer Kontrolle sind – externe APIs oder Dienste von Drittanbietern. Diese stellen eine **Grauzone** dar, wo Contracts existieren, aber du auf deiner Seite nicht garantieren kannst, dass alles nach Plan läuft.

Wir behandeln es im Grunde wie Benutzereingabe, aber da es uns selten wichtig ist, was genau schiefgelaufen ist (außer Logging, aber eine propagierte Exception ist mehr als genug), führe ich in solchen Fällen normalerweise `Result<T>` ein:

```kotlin
class UserProfileRepository(
    private val cache: ConcurrentHashMap<Long, UserProfile>, // sollte besseres Caching sein, nur ein Beispiel
    private val database: UserProfileDao,
    private val networkClient: UserProfileApi,
    private val logger: Logger,
) {
    suspend fun getUserProfile(userId: Long): Result<UserProfile> {
        // 1. In-Memory Cache ist vertrauenswürdiger Systemzustand
        val cached = cache[userId]
        if (cached != null) return Result.success(cached)

        // 2. Datenbank I/O ist eine Environmental Failure Grenze
        val dbEntity = suspendRunCatching { 
            database.getById(userId) 
        }.getOrElse { return Result.failure(it) }

        if (dbEntity != null) {
            // Mapping ist AUSSERHALB des Wrappers. Wenn das fehlschlägt, ist es ein Programmierfehler.
            // Und wir wollen nicht, dass er verschluckt wird.
            val profile = dbEntity.mapToDomain() 
            cache[userId] = profile
            return Result.success(profile)
        }

        // 3. Netzwerk I/O ist die häufigste Environmental Failure Grenze
        val response = suspendRunCatching { 
            networkClient.fetchUser(userId) 
        }.getOrElse { return Result.failure(it) }

        // Wieder ist Mapping außerhalb, um sicherzustellen, dass wir keine Bugs verstecken
        val profile = response.mapToDomain()

        // 4. Datenbank Write (Best-effort Side-effect)
        // Persistenz ist eine zweitrangige Sorge. Wir wrappen und loggen es, damit 
        // ein Disk/DB-Fehler dem Benutzer nicht ein 
        // erfolgreich abgerufenes Ergebnis vorenthält.
        suspendRunCatching { 
            database.insert(profile) 
        }.onFailure { throwable ->
            logger.error("Failed to persist user profile to DB", throwable)
        }
        cache[userId] = profile

        return Result.success(profile)
    }
}
```
Es ist entscheidend zu bemerken, dass wir nicht die gesamte Funktion in ein einziges `suspendRunCatching` wrappen (eine selbstgemachte Alternative zu `runCatching`, die keine `CancellationException` verschluckt und so Bruch von Structured Concurrency verhindert). Stattdessen wrappen wir chirurgisch nur die spezifischen I/O-Grenzen, wo Fehler eine Realität der Umgebung sind.

Die Mapping-Logik (`mapToDomain`) ist absichtlich außen vor gelassen. Wir erwarten nicht, dass unser internes Mapping fehlschlägt; wenn es das tut, ist es ein Programmierfehler, kein Runtime-Fehler. Indem wir es außerhalb des Wrappers halten, stellen wir sicher, dass die App sofort crasht, was uns erlaubt, den Bug zu fangen, anstatt ihn innerhalb eines `Result.failure` totzuschweigen.

Außerdem hast du vielleicht gesehen, wie wir den Datenbank-Insert-Fehler behandelt haben. Wir drücken aus, dass dieser Fehler nicht so kritisch ist; wir können ihn als eine Ausnahme betrachten, die keinen exzeptionellen Zustand signalisiert, sondern eher einen degradierten Zustand eines nicht-kritischen Side-Effects. Da der primäre Contract (Lieferung des Benutzerprofils) bereits durch den Netzwerk-Abruf und das Mapping erfüllt wurde, ist ein Fehler in der Persistenzschicht zweitrangig. Es ist eine Best-Effort-Operation, wo der transiente Zustand der lokalen Festplatte die erfolgreiche Lieferung des primären Ergebnisses an den Aufrufer nicht brechen darf.

Am Ende des Tages kannst du auch das gleiche Muster einführen, das wir für Benutzereingaben mit Sealed Result anwenden – es hängt davon ab, wie wichtig es dir ist, _Spezifika_ des Fehlschlags zu behandeln. Aber die Logik von Programmierfehlern bleibt gleich.

### Falsche Sicherheit (False Safety)
#### Weniger fangen (Catch.. less)

Um auf das Beispiel aus dem vorherigen Abschnitt zurückzukommen – genauer gesagt die Datenbank – können wir wirklich sagen, dass _jeder_ Fehler, der von einem Insert oder einer anderen Datenbankoperation geworfen wird, ein Umgebungsfehler und kein Programmierfehler ist?

Wie wir früher mit `mapToDomain` festgestellt haben, wollten wir explizit nicht alles in `suspendRunCatching` wrappen. Der Grund ist einfach: Wir wollen keine Fehler ignorieren, die nicht Teil des unkontrollierten Outputs sind.

Eine Datenbank kann in sehr verschiedenen Szenarien werfen:
- **Umgebungsfehler** – temporäre Netzwerkprobleme, Erschöpfung des Connection Pools, Datenbank-Restarts, Timeouts. Diese sind selten, aber sie _passieren_, und sie sind größtenteils außerhalb deiner Kontrolle.
- **Programmierfehler verursacht durch ungültiges Schema oder Annahmen** – fehlende Indizes, verletzte Constraints, inkompatible Spaltentypen, unpassende Migrationen, inkorrektes SQL. Diese deuten auf einen gebrochenen Contract innerhalb deines Systems hin, nicht auf eine instabile Umgebung.

Beide Kategorien gleich zu behandeln, ist der Punkt, wo falsche Sicherheit beginnt, sich einzuschleichen.

Ja, wir wollen nicht, dass unsere Benutzer Crashes sehen, die durch Dinge verursacht werden, die sie nicht kontrollieren – und oft Dinge, die _wir_ auch nicht kontrollieren. Aber das bedeutet nicht, dass wir Fehler blind totschweigen sollten. Tools wie detekt oder ktlint warnen dich aus einem Grund: Explizit darüber zu sein, was du _absichtlich_ ignorierst, ist Teil des Schreibens von ehrlichem Code.

Die Frage ist nicht _"sollte das werfen?"_, sondern eher _"was genau bin ich bereit, hier totzuschweigen?"_

Consider this simple function I recently implemented:
```kotlin
public suspend inline fun <reified T : Enum<T>> R2dbcTransaction.createEnumTypeIgnoring() {
    val enumName = T::class.simpleName?.lowercase() ?: error("Enum must have a name")
    val enumValues = enumValues<T>().joinToString(",") { "'${it.name}'" }

    try {
        exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
    }  catch (_: Exception) {
        // postgresql does not support CREATE TYPE IF NOT EXISTS, so we want to ignore such errors;
    }
}
```
Auf den ersten Blick sieht das vernünftig aus. Aber wo ist der Haken?

Wir fangen **viel zu breit**. Indem wir `Exception` verschlucken, ignorieren wir nicht nur den "Typ existiert bereits"-Fall – wir ignorieren auch:
- SQL-Syntaxfehler
- Berechtigungsprobleme
- kaputte Verbindungen
- falsch konfigurierte Transaktionen
- oder sogar Bugs, die durch zukünftiges Refactoring eingeführt werden

Eine erste Verbesserung könnte so aussehen:

```kotlin
try {
    exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
}  catch (e: R2dbcException) {
	// postgresql does not support CREATE TYPE IF NOT EXISTS, so we want to ignore such errors;
}
```
Das ist besser, aber immer noch unzureichend. Wir ignorieren jetzt _alle_ Fehler auf Datenbankebene – einschließlich derer, die absolut an die Oberfläche kommen sollten.

Wir können es weiter eingrenzen:
```kotlin
try {
	exec("CREATE TYPE $enumName AS ENUM ($enumValues)")
}  catch (e: R2dbcException) {
	// In PostgreSQL, SQLSTATE 42710 corresponds to duplicate_object.
    if (e.sqlState != "42710") {
            throw e
    }
}
```
Jetzt ist die Absicht explizit. Wir sagen nicht _"Datenbankfehler sind egal"_. Wir sagen _"dieser sehr spezifische Fehler ist erwartet und akzeptabel; alles andere ist es nicht"_.

Und das gilt nicht nur für solche "Helper"-Funktionen – es gilt überall.

#### Fehlschlag hat ein Ziel (Failure has destination)
Und während du normalerweise keine Exceptions wie zuvor "kaputte Verbindung" (besonders die) außerhalb deines Datenbank-Layers leaken willst (was offensichtlich weder unsere noch die Schuld des Benutzers sein könnte), bedeutet das nicht, dass jeder Fehler überall dort gefangen werden sollte, wo er auftreten könnte.

Manche Fehlschläge **treten erwartungsgemäß auf**, aber das bedeutet nicht, dass sie überall dort behandelt werden sollten, wo sie entstehen.
Eine kaputte Verbindung, ein Transaktionsfehler oder ein Treiberfehler sind Teil der Umgebung, in der dein Code läuft. Sie sind weder Programmierfehler noch Bedingungen, die stillschweigend absorbiert werden sollten.

Diese Fehlschläge müssen **propagieren dürfen, bis sie die Grenze erreichen, die die Entscheidung besitzt, was als Nächstes zu tun ist**. Sie früher zu fangen, macht das System nicht sicherer – es versteckt nur die Tatsache, dass etwas schiefgelaufen ist, und schiebt die Verantwortung an den falschen Ort.

Und deshalb haben wir im `createEnumTypeIgnoring`-Beispiel die gesamte Funktion _nicht_ in ein breites `try/catch` gewrappt – für sich allein bedeutet und tut das nichts. Dort dürfen unkontrollierte Fehlschläge propagieren – und es wird erwartet. Die Funktion bringt nur den **spezifischen, verstandenen Fall** zum Schweigen, der Teil ihres Contracts ist (Duplikat-Typ), und lässt alles andere entkommen.

Das ist Absicht. Bei Error Handling geht es nicht darum zu verhindern, dass Exceptions geworfen werden; es geht darum, **die Grenze zu wählen, wo sie behandelt werden sollten**.

Eine Exception zu früh zu fangen, flacht den Kontext ab. Sie zu spät zu fangen, leakt Infrastruktur-Details. Der richtige Ort ist normalerweise eine Grenze, die beide Seiten versteht: Sie weiß, _welche Operation versucht wurde_ und _was der Aufrufer vernünftigerweise als Nächstes tun kann_.

Das ist auch der Grund, warum wir auch nicht überall "einen Logger propagieren". Logging gehört, wie Error Handling, zu einer Grenze, die genug Kontext hat, um zu entscheiden, ob ein Fehlschlag erwartetes Rauschen, ein degradierter Zustand oder ein echter Bug ist.

Kurz gesagt:
- Manche Fehler sollten werfen (throw).
- Manche Fehler sollten reisen.
- Sehr wenige Fehler sollten "nur für den Fall" gefangen werden.

Die Disziplin liegt nicht im Vermeiden von Exceptions, sondern darin, **sie sich bewegen zu lassen, bis sie die Grenze erreichen, die ihnen Bedeutung geben kann**.

## Bonus
By the way, do you still remember [`Deferred<T>.getCompletionExceptionOrNull(): T?`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completion-exception-or-null.html)? If you assumed it _returns the completion exception or `null` andernfalls zurückgibt_ – lagst du falsch. Ich auch. Bis es in echtem Code eine Exception **geworfen** hat.

Erst nachdem man einen Bug getroffen hat, landet man normalerweise in den Docs, wo es heißt:
> Returns _completion exception_ result if this deferred was cancelled and has completed, `null` if it had completed normally, or throws [`IllegalStateException`](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-illegal-state-exception/index.html) if this deferred value has not completed yet.
> 
> This function is designed to be used from [`invokeOnCompletion`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/invoke-on-completion.html) handlers, when there is an absolute certainty that the value is already complete. See also [`getCompleted`](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/get-completed.html).
> 
> **Note: This is an experimental api.** This function may be removed or renamed in the future.

Dies ist kein Missbrauch – es ist eine schlecht geformte API. Der Name, Rückgabetyp und gängige Konventionen deuten stark auf eine _sichere Abfrage_ (Safe Query) hin, doch die Funktion versteckt eine Control-Flow-Falle dahinter.

Die Lektion ist nicht "lies die Docs sorgfältiger". Die Lektion ist: **Designe keine APIs, die etablierte Erwartungen verletzen** – besonders rund um Fehler.

Die Lektion für die `kotlinx.coroutines`-Maintainer ist eine harte: Was ist kritischer – eine Funktion als `OrNull` zu labeln, nur weil der Rückgabetyp nullable ist (als ob wir das nicht vom Compiler wüssten..?), oder den Entwickler vor einer versteckten `IllegalStateException` zu warnen? Indem man sich auf das `null` fokussiert, verschleiert die API die Gefahr. In einem ehrlichen System hat es ein paar Optionen:
- es sollte nicht werfen,
- `OrNull`-Marker sollte durch `OrThrow` ersetzt werden. Das würde Sinn ergeben, wenn es irgendein Gegenstück (Counterpart) hätte,
- zumindest sollte es nicht über seine Sicherheit lügen, indem es `OrNull` hat.

## Abschließende Gedanken
`OrThrow`, `OrElse` und `try*` drehen sich nicht darum, wie Fehlschläge produziert werden, sondern darum, wie Fehlerzustände konsumiert werden.

Jede Variante repräsentiert einen anderen Weg für den Aufrufer, mit einem verletzten Contract umzugehen. Welche angemessen ist, hängt von der Grenze ab, an der du operierst.

Für vertrauenswürdige Grenzen – wie systemeigener Code oder Daten, die aus einer Datenbank kommen, die bereits validiert wurde – ist Exception-First oft mehr als eine akzeptable Wahl. An diesen Punkten deutet ein Fehlschlag normalerweise auf einen Bug hin, nicht auf eine Situation, die man beheben kann, und Throwing kommuniziert das klar.

Für nicht vertrauenswürdige oder mehrdeutige Grenzen – wie Benutzereingabe oder externe Systeme, die wir nicht kontrollieren – sind Safe-First APIs ehrlicher. Der Fokus auf die Rückgabe eines Type-Safe-First-Ergebnisses macht Fehlschläge explizit und zwingt den Aufrufer, sie dort anzuerkennen, wo Input unerwartet ist. Unsichere Varianten wie `OrThrow` können immer noch existieren, aber sie sollten sekundär und absichtlich Opt-in sein.

Am wichtigsten ist, dass `OrThrow` nicht als Marker verwendet werden sollte, dass "diese Funktion werfen kann". Sein Zweck ist es, einen alternativen Weg anzubieten, einen Fehlerzustand zu konsumieren, nicht nur um Gefahr zu annotieren. Wenn es übermäßig genutzt wird, verliert es seinen Signalwert und wird zu Rauschen.

Diese Muster sind Werkzeuge, keine Regeln. Sie funktionieren am besten, wenn sie bewusst gewählt werden, basierend auf dem Contract, den du definierst, der Grenze, die du überquerst, und wem der Fehler gehört. Nutze sie bedacht – nicht aus Gewohnheit, sondern aus Absicht.

Schließlich, erinnere dich an **die Kosten falscher Sicherheit**: Blindes Totzuschweigen von Fehlern oder das Über-Beschützen jeder Operation kann echte Probleme verstecken. Behandle Fehlschläge bewusst, an den Grenzen, die du verstehst, und propagiere Exceptions dorthin, wo sie hingehören – nicht überall, nicht nirgendwo.
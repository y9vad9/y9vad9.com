---
title: Semantische Typisierung, die wir ignorieren
preview: "Der Sprung von der „Das ist ein String“-Mentalität zu „Das ist ein Konzept“. Was semantische Typisierung in Kotlin ist, wann sie dem Domänenmodell hilft und wann sie im Weg steht."
date: 2025-12-24
coverImage: "attachments/semantic-typing-cover.webp"
parents: ["Kotlin", "Softwaredesign"]
---
In Kotlin schränken wir unsere Typen ständig ein. Wir bevorzugen `String` gegenüber `Any` für Text, `Int` gegenüber `Any` oder sogar `Number` für ganze Zahlen. Das fühlt sich offensichtlich an — fast trivial. Erledigt, oder?

Also, worum geht es in diesem Artikel eigentlich?

Während wir `Any` in den meisten Situationen unterbewusst vermeiden — aus guten Gründen oder manchmal einfach, weil „warum sollte ich hier `Any` statt `Int` verwenden?“ — wenden wir oft nicht dasselbe Denken an, wenn wir unsere eigene Software modellieren: ihre Typen, ihr Verhalten und die Beziehungen zwischen ihnen.

Dieser Artikel untersucht die Praxis der **semantischen Typisierung** — was sie bedeutet, warum man sie vielleicht möchte, wann sie den Code verbessert und wann sie zu einem Hindernis wird. Wir werden uns ansehen, wie sich semantische Typisierung in echten Kotlin-Projekten zeigt, sowohl im Anwendungscode als auch im Bibliotheksdesign, und was tendenziell gut funktioniert — oder eben nicht.

Auch wenn du Domain-Driven Design nicht folgst, gelten diese Ideen trotzdem. Du schränkst Typen bereits jeden Tag ein; in diesem Artikel geht es darum, dies bewusst und durchdacht zu tun.

Wir werden diese Lektionen in praktische Regeln destillieren, die dir helfen zu entscheiden, **wann Typen semantisch eingeschränkt werden sollten** — geleitet von Vernunft, nicht von Intuition oder Gewohnheit.

## Was ist semantische Typisierung?
Beginnen wir damit zu definieren, worüber wir eigentlich sprechen, warum es wichtig ist und warum es nichts ist, das man einfach ignorieren kann.

**Semantische Typisierung** ist die Praxis, semantisch bedeutungsvolle Teilmengen von Allzwecktypen zu erstellen, um Absichten auszudrücken und versehentlichen Missbrauch zu verhindern. Es geht darum, von strukturellen Typen („das ist ein String“) zu verhaltensbezogenen oder semantischen Typen („das ist eine E-Mail“) überzugehen.

Die Idee der semantischen Typisierung ist nicht einzigartig für Kotlin — sie ist seit langem eine gängige Praxis in Sprachen wie Java, wo Entwickler leichtgewichtige Wrapper-Klassen (z.B. `UserId`, `Email`) um Primitive definieren, um Domänenbedeutung zu kodieren und versehentlichen Missbrauch zu verhindern.

Zum Beispiel:
```kotlin
@JvmInline
value class EmailAddress(val raw: String) { ... }
```

Es ist erwähnenswert, dass sich semantische Typisierung nicht auf das Wrappen von Primitiven beschränkt; sie gilt gleichermaßen für das Wrappen jedes Typs — sei es ein einfaches Int oder eine komplexe `Map<K, V>`. Die Kernidee ist es, semantische Bedeutung und stärkere Typsicherheit zu verleihen, indem Werte über ihre bloße Struktur hinaus unterschieden werden.

Warum sollte dich das interessieren? Das ist normalerweise der Punkt, an dem Skepsis aufkommt. Wann immer dieser Ansatz zur Sprache kommt, klingen die Reaktionen oft so:
> Was bekomme ich als Gegenleistung für diesen zusätzlichen Code? Ist das nicht einfach nur mehr Boilerplate?

Das sind völlig berechtigte Fragen — es zwingt dich dazu, mehr Zeit in das Nachdenken über die Modellierung deines Codes zu investieren, und insgesamt dauert es länger, ihn zu schreiben. Ich bin voll und ganz dafür, den Ideen von [KISS](https://en.wikipedia.org/wiki/KISS_principle) zu folgen und das Problem falscher Abstraktionen zu vermeiden.. und nun zu einem großen ABER! 🌚

Was du im Gegenzug erhältst, ist eigentlich keine Abstraktion um ihrer selbst willen — es ist Klarheit. Sehen wir uns an, was das in der Praxis bedeutet.

## Warum?
### Kompilierzeit-Sicherheit (Compile-time safety)
Erstellen wir ein Beispiel:
```kotlin
/**
 * @param value Die Breite in dichteunabhängigen Pixeln (dp). 
 */
fun setWidth(value: Int) { ... }
```

Auf den ersten Blick sieht das gut aus. Aber es ist leicht, beim Aufruf versehentlich die Maßeinheit zu vertauschen:
```kotlin
val containerSize = 1000 // zufälliges Int oder einfach ein roher Pixelwert
card.setWidth(containerSize) // dp wurde erwartet
```
Der Code kompiliert erfolgreich und mag sogar gültig erscheinen, aber da liegt ein großer Fehler, den du innerhalb einer Funktion nicht validieren kannst.

Indem wir Typen einschränken, machen wir ungültige Aufrufe zur Kompilierzeit unmöglich. Wir können zum Beispiel den semantischen Typ `Dp` einführen:
```kotlin
@JvmInline
value class Dp(public val raw: Int) { ... }

/**
 * @param value Die Breite in dichteunabhängigen Pixeln (dp). 
 */
fun setWidth(value: Dp) { ... }
```
Wenn nun das Argument `value` übergeben wird, stellen wir sicher, dass die Aufrufstelle sich der erwarteten Maßeinheit voll bewusst ist.

### Dokumentation
Ich bin nicht der Einzige, der gelegentlich zu faul ist, Dokumentation zu prüfen oder zu schreiben, oder? Aber mach mir keinen Vorwurf — wie ein weiser Mann einmal sagte (Robert C. Martin in Clean Code):
> Bevor du einen Kommentar hinzufügst, überlege, ob du den Code so refaktorisieren kannst, dass seine Absicht auch ohne ihn klar ist. Kommentare, die lediglich wiederholen, was der Code tut, sind unnötig; guter Code sollte für sich selbst sprechen.

Semantische Typisierung lässt dich nicht nur einen Wert in eine Klasse verpacken — sie lässt dich **den Typ selbst dokumentieren**. Du vermittelst genau, welche Art von Daten erwartet wird, ohne diese Informationen in jeder Funktion wiederholen zu müssen, die sie verwendet. Selbstdokumentierender Code, richtig gemacht.

Zurück zu unserem Beispiel:
```kotlin
/**
 * @param value Die Breite in dichteunabhängigen Pixeln (dp). 
 */
fun setWidth(value: Dp) { ... }
```

Du findest die Dokumentation vielleicht etwas lustig — als ob man einfach etwas anderes statt `Dp` übergeben könnte. Aber abgesehen davon, dass dieser Kommentar fast obsolet wird, eliminieren wir auch ein anderes Problem: **Dokumentationsduplizierung**.

Denk darüber nach: Wenn wir `setWidth` haben, haben wir wahrscheinlich auch `setHeight`, `setSpacing` und ähnliche Funktionen. Ohne semantische Typisierung wird dieselbe Dokumentation überall kopiert — oder schlimmer noch, sie ist unvollständig, fehlt oder ist irgendwo völlig veraltet, weil jemand faul war oder es einfach vergessen hat. Dann muss jeder, der den Code liest, die erwartete Eingabe basierend auf anderen Teilen des Codes erraten, die er vielleicht gar nicht aufruft. Mit einem eingeschränkten Typ verschwindet dieses Rätselraten — du verwendest einfach den Typ dort wieder, wo es semantisch angemessen ist.

Aber da ist noch mehr. Jenseits des „Verpackens“ von Daten musst du **Identität und Semantik** berücksichtigen. Du klatschst nicht einfach einen zufälligen Namen darauf, wie den, den GitHub für dein Repo vorgeschlagen hat, du gibst ihm eine echte Bedeutung. Ein Typ sollte für sich allein stehen, ohne zusätzlichen Kontext zu benötigen, damit du nicht bei so etwas endest:

```kotlin
fun setWidth(dp: Int) { ... }
// vs
fun setWidth(dp: Size) { ... }
```

Wo du versuchst, die Maßeinheit durch die Parameterbenennung auszudrücken. Und stattdessen die Funktion zu dokumentieren, macht auch keinen besseren Job. Wer zwingt dich oder mich, den Parameternamen zu überprüfen? Was ist, wenn ich nach einem langen Arbeitstag fälschlicherweise angenommen habe, dass sie rohe Pixel akzeptiert?

Selbst im zweiten Beispiel könntest du die Einheiten immer noch durcheinanderbringen, was es effektiv zu einem weiteren `Int` macht, nur verpackt und mit etwas weniger Mängeln (wir haben es davor geschützt, nur ein zufälliges `Int` zu einem zufälligen `Size` zu sein). Und die alte `Int`-Version? Völlig generisch — sie sagt uns etwas und gleichzeitig nichts. Semantische Typisierung, und genauer gesagt das Konzept des Value Objects, sollte und zwingt den Code dazu, **laut und deutlich zu sagen, was er bedeutet**. Das macht ihn mächtig und selbstdokumentierend.

### Validierung
Ein weiterer Vorteil der Einführung semantischer Typisierung ist die **Validierung**. Wir kehren zur Selbstdokumentation zurück, aber dieses Mal liegt der Fokus auf der **Wiederverwendung**.

In unseren vorherigen Beispielen musste jede Funktion dichteunabhängige Pixel individuell validieren, um schnell fehlzuschlagen (hoffentlich haben wir das getan, oder?) und versteckte Fehler zu vermeiden:
```kotlin
fun setWidth(dp: Int) {
	require(dp < 0) { "dp cannot be negative" }
	// ...
}

fun setHeight(dp: Int) {
	require(dp < 0) { "dp cannot be negative" }
	// ...
}
// ...
```
Jetzt können wir diese Logik in den Typ selbst verschieben und ihn zu einem echten Teilmengentyp machen, genau wie wir es zuvor definiert haben:
```kotlin
@JvmInline
value class Dp(public val raw: Int) {
	init {
		require(dp < 0) { "dp cannot be negative" }
	}
}
```

Beachte, wie dies wiederholte Validierung eliminiert, Korrektheit überall garantiert und die beabsichtigten Einschränkungen klar dokumentiert.

> **Hinweis** <br/>
> Du kannst natürlich eine robustere Validierung einführen, um je nachdem, wo und wie sie verwendet wird, typsicherer zu sein; Da es in diesem Artikel vor allem um semantische Typisierung und weniger um Validierung geht, kannst du dich [hier](contract-violation-handling) separat über Validierung informieren.

Wir hätten **Dokumentation** und **Validierung** eigentlich in einen Abschnitt zusammenfassen können — aber ich habe sie bewusst getrennt gehalten. Warum? Weil einige Validierungsherausforderungen subtiler sind und die Verwendung eines semantischen Typs sie perfekt hervorhebt.

Nehmen wir ein Beispiel aus der realen Welt, auf das wir in der Einleitung hingewiesen haben:
```kotlin
@JvmInline
value class EmailAddress(val raw: String) { ... }
```

E-Mail-Validierung war schon immer Kopfzerbrechen bereitend. Verschiedene Teile eines Systems können **unterschiedliche Regeln** durchsetzen, oft ohne dass es jemand bemerkt. Eine Funktion prüft vielleicht nur, ob der String ein @ enthält. Eine andere verwendet vielleicht einen vereinfachten StackOverflow-Regex. Eine dritte versucht vielleicht, den vollen RFC-Standard zu implementieren.

Das Ergebnis? Drei Funktionen, die **semantisch dieselbe Eingabe erwarten**, verhalten sich möglicherweise unterschiedlich: eine akzeptiert einen String, andere lehnen ihn ab. Solche Fehler sind subtil, schwer zu finden und nervig zu debuggen.

Indem du es auf einen semantischen Typ einschränkst, **zentralisierst du die Einschränkung**:
- Jede `EmailAddress`-Instanz ist garantiert gültig gemäß deinen Regeln. Und sie bleiben gleich.
- Konsumenten des Typs **müssen die Validierung nicht wiederholen**.
- Der Compiler erzwingt, dass nur gültige Daten durch dein System fließen.

Validierung + Selbstdokumentation + Kompilierzeit-Sicherheit: Das ist die Kraft der semantischen Typisierung in der Praxis.

## Wann sollte man es verwenden?
Mit den Beispielen im Hinterkopf können wir nun eine Regel aufstellen, wann wir **semantische Typisierung** tatsächlich verwenden sollten und wann höchstwahrscheinlich nicht.

Abhängig von deinem Projekt oder den Anforderungen an den Anwendungscode kann dies variieren, aber nicht allzu sehr. Wir wollen definitiv kein Over-Engineering betreiben!

### Anwendungscode
Beginnen wir mit dem, worauf sich Kotlin zuerst konzentriert — Anwendungscode. Normalerweise wenden wir in unseren Projekten Designmuster wie Clean Architecture, Domain-Driven Design und manchmal sogar Hexagonale Architektur an. Alle teilen eine gemeinsame Schicht — die Domäne —, die in irgendeiner Form von DDD abgeleitet ist (lies meinen Artikel, wenn du damit nicht vertraut bist: [Das richtige Gleichgewicht zwischen DDD, Clean und Hexagonal Architekturen finden](finding-balance-between-ddd-hexagonal-and-clean-architectures)).

Im Kontext von Domänenschichten setzen wir typischerweise Geschäftsregeln, Einschränkungen und die gesamte Kern-Geschäftslogik durch, isoliert von Infrastruktur- oder Anwendungsbelangen. Da Domänen die Sprache der Domänenexperten widerspiegeln sollen, ist es normalerweise vorteilhaft, **semantische Typisierung** und genauer gesagt **Value Objects** einzuführen.

Nehmen wir ein Beispiel — ein User-Aggregat:
```kotlin
data class User(
	val id: Int,
	val email: String,
	val name: String,
	val bio: String,
)
```

Um Geschäftsregeln und Einschränkungen durchzusetzen, könntest du verschiedene Wege einschlagen. Beginnen wir mit dem **Gegenteil von semantischer Typisierung**, nur um zu sehen, was schiefgehen kann:
```kotlin
data class User(
	val id: Int,
	val email: String,
	val name: String,
	val bio: String?,
) {
	init {
		require(id >= 0)
		require(email.matches(emailRegex))
		require(name.length in 2..50)
		require(bio == null || bio.length in 0..500)
	}
}
```

Das ist kein ungültiger Ansatz, aber überlegen wir, was hier schiefgehen oder sich suboptimal anfühlen kann.

**Duplizierung** ist ein offensichtliches Problem. Es ist üblich, mehrere Darstellungen derselben Entität (in diesem Fall `User`) mit denselben Eigenschaften zu sehen, was dich dazu zwingt, die Validierung zu duplizieren:
  
```kotlin
data class PublicUser(
	val id: Int,
	val name: String,
	val bio: String
) {
	init {
		require(id >= 0)
		require(name.length in 2..50)
		require(bio == null || bio.length in 0..500)
	}
}
```
Hier enthält User vollständige Informationen für den Besitzer, während `PublicUser` an alle anderen ohne die E-Mail zurückgegeben wird. Abgesehen von dem Unbehagen der Duplizierung neigen Regeln und Einschränkungen dazu, sich im Laufe der Zeit zu ändern, was diesen dezentralen Ansatz fragil und anfällig für Vergesslichkeit macht.

Die Lösung? Einführung von **Value Objects** mit semantischer Typisierung. Jede Eigenschaft wird zu einem Typ, der **seine Einschränkungen kodiert**, die Validierung zentralisiert und dein Domänenmodell selbstdokumentierend macht:
```kotlin
@JvmInline
value class UserId(val raw: Int) {
    init { require(raw >= 0) }
}

@JvmInline
value class Email(val raw: String) {
    init { require(raw.matches(emailRegex)) }
}

@JvmInline
value class UserName(val raw: String) {
    init { require(raw.length in 2..50) }
}

@JvmInline
value class Bio(val raw: String?) {
    init { require(raw == null || raw.length in 0..500) }
}

data class User(
    val id: UserId,
    val email: Email,
    val name: UserName,
    val bio: Bio,
)
```

Mit diesem Ansatz ist die **Validierung zentralisiert**, Duplizierung verschwindet und deine Domänenobjekte werden **selbsterklärend und per Design sicherer**. Jede Eigenschaft trägt nun semantische Bedeutung, und alle Änderungen an Regeln müssen nur im Value Object selbst vorgenommen werden, nicht verstreut über mehrere Klassen.

Betrachten wir auch eine komplexere Struktur, anstatt nur Primitive zu wrappen. Stell dir vor, wir haben **zwei Bounded Contexts** (Features):
- Eines ist verantwortlich für den **Warenkorb**,
- Das andere ist verantwortlich für **Zahlungen**.

Beide Features teilen sich dieselben zugrunde liegenden Daten — ausgewählte Produkte —, aber die **Geschäftsregeln unterscheiden sich**. Für den Warenkorb ist es zulässig, einen leeren Warenkorb zu haben, während der Benutzer noch Produkte auswählt. Für die Zahlungsfunktion ist es jedoch entscheidend, dass der Warenkorb **nicht leer** ist — der Benutzer muss mit mindestens einem ausgewählten Produkt ankommen:
```kotlin
data class PaymentCart(
    val userId: Int,
    val products: List<Product>
) {
    init {
        require(userId >= 0)
        require(products.isNotEmpty()) // darf für die Zahlung nicht leer sein
    }
}
```

Währenddessen könntest du stattdessen so etwas haben:
```kotlin
@JvmInline
value class ProductSelection(val raw: List<Product>) {
	// kann etwas robusteres mit Factory-Pattern und typsicherem Ergebnis für die äußere Schicht sein, da es Teil der Benutzereingabe ist
    init { require(raw.isNotEmpty()) } // erzwingt nicht-leere Liste
}

data class PaymentCart(
    val userId: Int,
    val products: ProductSelection
)
```
Nun garantiert der Typ selbst die Einschränkung: **Du kannst keine ProductSelection mit einer leeren Liste konstruieren**, was das Risiko eliminiert, die Validierung zu vergessen, wenn wir beispielsweise mehr als ein Aggregat haben, wie `PaymentCart` und `Bill`.

Wir können ProductSelection auch zusätzliches Verhalten geben. Zum Beispiel, wenn bestimmte Kampagnen Lieferkosten abhängig von den gekauften Produkten einschränken:
```kotlin
@JvmInline
value class ProductSelection(val raw: List<Product>) {
    init { require(raw.isNotEmpty()) }
    
    val specialProducts: List<Product>
        get() = raw.filter { /* eine Filterlogik */ }
}

data class PaymentCart(
    val userId: Int,
    val products: ProductSelection
) {
    val deliveryCosts: Money
        get() = if (products.specialProducts.size >= 3) Money.ZERO else /* normale Kosten */
}
```
Während du diese Logik technisch innerhalb des Aggregats selbst implementieren könntest, **vereinfacht das Lokalisieren von Verantwortlichkeiten im Value Object (semantischer Typ) den Code**, macht die API expliziter und hält das Aggregat auf die Kern-Domänenlogik fokussiert. Und warum sollte das nur für Code in der Domänenschicht gelten?
### Bibliothekscode
Auch wenn Bibliothekscode oft eine zusätzliche Komponente jeder Anwendung ist — was bedeutet, dass er nicht immer den strengen Regeln, Konventionen oder Ansätzen folgt, die für Anwendungscode typisch sind (abgesehen von generischen Best Practices) — würde ich dennoch dringend empfehlen, denselben Ansatz zu verwenden, um deine Typen fast überall einzuschränken.

Anwendungscode wird normalerweise mit dem Ziel geschrieben, die Vorabkosten zu minimieren. Das bedeutet, dass es zwar lohnenswert sein kann, in bestimmten Teilen (wie der Domänenschicht) strikte Modellierung anzuwenden, um zukünftigen Test- und Wartungsaufwand zu reduzieren, aber dasselbe strikte Modell überall beizubehalten, erscheint oft unnötig oder übertrieben. Meiner Meinung nach fallen Bibliotheken jedoch nicht unter diese „kostensparende“ Begründung.

Betrachte das folgende Beispiel:
```kotlin
@Serializable
sealed interface JsonRpcResponse<T> {
	val jsonrpc: JsonRpcVersion
	id: JsonRpcRequestId

	data class Success<T>(
		val jsonrpc: JsonRpcVersion,
		id: JsonRpcRequestId,
		val result: T,
	) : JsonRpcResponse<T>

	data class Error(
		val jsonrpc: JsonRpcVersion,
		id: JsonRpcRequestId,
		val error: JsonRpcResponseError,
	)
}

@Serializable
@JvmInline
value class JsonRpcVersion(val string: String) {
	companion object {
		val V2_0 = JsonRpcVersion("2.0")
	}
}

@Serializable
@JvmInline
value class JsonRpcRequestId(val jsonElement: JsonElement) {
    init {
        require(jsonElement is JsonNull || jsonElement is JsonPrimitive) {
            "JSON-RPC ID must be a primitive or null"
        }
        
        if (jsonElement is JsonPrimitive) {
            require(jsonElement.isString || jsonElement.intOrNull != null || jsonElement.longOrNull != null || jsonElement.doubleOrNull != null) {
                "JSON-RPC ID must be a string or number"
            }
        }
    }
    
    val isString: Boolean get() = jsonElement is JsonPrimitive && jsonElement.isString
    // ... anderes
    val asString: String? get() = if (isString) (jsonElement as JsonPrimitive).content else null
    // ... anderes
}

// ... andere Klassen auf die gleiche Weise
```

Wie wir sehen können, setzen wir semantische Typen fast überall ein! Denken wir darüber nach:
- `JsonRpcRequestId` ist mit demjenigen verbunden, der in der ursprünglichen Anfrage präsentiert werden sollte, was bedeutet, dass es sowohl für Bibliothekscode (weniger fehleranfällig aufgrund des menschlichen Faktors) vorteilhaft ist. Darüber hinaus repräsentiert es ein echtes Konzept, das aus der Spezifikation abgeleitet ist.
- `JsonRpcVersion` wird ebenfalls wiederverwendet, aber es wird nicht so häufig verwendet, und insgesamt ist die Begründung eine andere — es repräsentiert zuallererst das Konzept und macht den Typ selbsterklärend, indem es auf die JsonRpc-Spezifikation verweist. Der Code, der es validiert, weiß nun, dass er `JsonRpcVersion` akzeptiert und nichts anderes.

Am Ende würde ich sagen, dass du in den meisten Fällen semantische Typen definieren musst, um klare Grenzen für dich selbst und andere zu ziehen, aber mit Ausnahmen, über die wir später sprechen werden.
### Beispiele aus der realen Welt
Springen wir nun zu Beispielen aus der realen Welt, um zu sehen, wo wir diese Technik anwenden, um darüber nachzudenken und unseren Kontext zu erweitern.

### Standardbibliothek
Nimm `Thread.sleep()`:
```kotlin
Thread.sleep(5) // fünf was? Millisekunden? Sekunden? wer weiß
```

Die **Maßeinheit ist nicht explizit**. Du bist gezwungen zu raten und es zu wissen und manuell umzurechnen, wenn du:
```kotlin
Thread.sleep(5 * 60_000) // jetzt sind es fünf Minuten, vielleicht
```

Einige Entwickler könnten es in eine `java.time.Duration` verpacken und vor Ort in Millisekunden umrechnen, während andere einfach rohe Zahlen schreiben und sie multiplizieren. Nichts **erzwingt** Konsistenz. Jeder Entwickler schreibt das, was er für richtig hält, und der Code wird unkonventionell, fast zufällig. Ein Fehler bei der Konvertierung, und das Verhalten bricht stillschweigend. Und die Codekomplexität? Sie wird rau.

Semantische Typisierung löst dieses Problem elegant. Zum Beispiel mit Kotlins Duration-Typ und gut gestalteter API:
```kotlin
suspend fun delay(duration: Duration) {...}

suspend fun foo() {
	delay(5.minutes)
}
```
Viel einfacher zu lesen, oder?
### Android Views vs Jetpack Compose
In klassischen Android Views sieht das Festlegen von Größen oft so aus:
```kotlin
val view = ImageView(context)

view.layoutParams = ViewGroup.LayoutParams(200, 300) // was sind diese Zahlen? px oder dp?

view.layoutParams = ViewGroup.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    ViewGroup.LayoutParams.WRAP_CONTENT
)
```

Das erste Problem ist, dass du auf den ersten Blick und ohne Dokumentation zu lesen **nicht über die Eingabeparameter** von `layoutParams` urteilen kannst — sind das 200 in Pixeln? dp? Wer weiß? Sicher, im Android Framework sind sich die meisten Leute dessen bewusst, dank umfangreicher Dokumentation und allgemeinem Ökosystemwissen. Aber wenn du deine eigene Bibliothek oder Anwendung erstellst, **erhältst du nicht dasselbe Sicherheitsnetz**. Dein Code ist wahrscheinlich nicht gut dokumentiert, und Leute merken sich selten interne Details. Dies führt zu falschen Annahmen, subtilen Fehlern und frustrierenden Debugging-Sitzungen. Erinnerst du dich auch daran, was einst ein weiser Mann sagte?

Das zweite Problem ist, dass du allein durch das Betrachten der `ImageView`-Klasse **keine Ahnung hast, dass diese Konstanten existieren** oder dass sie speziell zu `ViewGroup.LayoutParams` gehören. Auch wenn `ImageView` diese Klasse nicht einmal erweitert, wird erwartet, dass du die „Magie“ hinter `MATCH_PARENT` und `WRAP_CONTENT` kennst. Für jeden Neuling ist das ein Albtraum — Code, der technisch korrekt, aber völlig undurchsichtig ist.

Schau dir nun Jetpack Compose an:
```kotlin
Box(
    modifier = Modifier
        .width(200.dp)
        .height(300.dp)
        .fillMaxWidth()
) {...}
```
Compose löst dasselbe Problem durch **semantische Typisierung**:
- `Dp` verpackt rohe Zahlen und verhindert versehentlichen Missbrauch.
- Intrinsische Größen wie `fillMaxWidth()` sind **typisierte Funktionen**, keine magischen Zahlen.
- Der Compiler erzwingt Korrektheit — kein Raten mehr über Einheiten oder Konstanten.

Der Unterschied ist frappierend: Compose **schiebt Korrektheit in das Typsystem**, macht Code **selbstdokumentierend, sicherer und einfacher zu verstehen**, während klassische Views auf Konventionen und mentale Überprüfungen angewiesen sind.

Dies ist eine perfekte Illustration aus der realen Welt, warum **semantische Typisierung wichtig ist**: Sie reduziert den mentalen Overhead, verhindert Missbrauch und kommuniziert Absichten direkt durch die Typen.

## Wann sollte man es nicht verwenden?

Denk an semantische Typisierung im Kontext von Value Objects aus DDD – in erster Linie als Konzepte der realen Welt. In den meisten Fällen — egal ob du eine Anwendung oder eine Bibliothek erstellst — sollten die Typen, die du definierst, Dinge repräsentieren, die **in der Welt, die deine Software modelliert**, existieren oder Sinn ergeben. Die meisten Werte, mit denen wir arbeiten, _entsprechen_ solchen Konzepten aus dem wirklichen Leben. Es ist jedoch leicht, sich hinreißen zu lassen und anzufangen, _Regeln_ statt _Ideen_ zu modellieren — was zu Typen führt, die deine Codebasis eher überladen als klären.

### Modellierung von Eingaben

Fangen wir mit etwas Einfachem an.

Nimm `PositiveNumber`. Auf den ersten Blick mag es nützlich erscheinen: Es erzwingt eine Einschränkung und könnte an vielen Stellen wiederverwendet werden. Aber **ist es ein Konzept?** Nicht wirklich.

Du magst sagen:

> **Aber warum sich die Mühe machen? Hast du nicht gesagt, dass das ein Vorteil der semantischen Typisierung ist — dass ich die Validierung zentralisieren kann? Ist das nicht genau das, wofür Variablennamen da sind? Wenn ich es `price: PositiveNumber` oder `distance: PositiveNumber` nenne, klärt das nicht alles?**

Das könnte es — **für einen Moment.** Aber Benennung allein reicht in der Praxis nicht aus:

- **Benennung reist nicht.** Sobald der Wert den Bereich verlässt, in dem er erstellt wurde, geht die Bedeutung oft verloren. Du kannst dich nicht darauf verlassen, dass jeder Entwickler — über jede Datei, Schicht oder jedes Feature hinweg — diese Klarheit aufrechterhält.
- **Leute verwenden Typen aus Bequemlichkeit wieder.** Wenn `PositiveNumber` funktioniert, wird es jemand für Preis, Entfernung, Artikelanzahl oder was auch immer sie passend finden, verwenden. Und sobald ein Typ generisch wiederverwendet wird, verschwindet seine ursprüngliche Absicht. Du willst keinen solchen „generischen“ Trend schaffen, sonst was ist der Sinn der Einführung eines Value Objects?
- **Reviews und Onboarding leiden.** Wenn derselbe Typ für viele Dinge verwendet wird, wird es schwieriger, über Code nachzudenken, schwieriger, Fehler zu verfolgen, und schwieriger für Neulinge zu verstehen, was ein Wert _tatsächlich_ darstellt.
- **Fehler schleichen sich stillschweigend ein.** Du bemerkst vielleicht nie, dass jemand versehentlich eine „Länge in Kilometern“ übergeben hat, wo „Preis in Euro“ erwartet wurde — weil der Typ `PositiveNumber` beides akzeptiert.

Das Problem ist also nicht, dass Namen schlecht sind — es ist, dass **sie zu leicht missverstanden, zu leicht missbraucht und zu leicht vergessen sind.** Wenn etwas Preis _bedeutet_, mach es zu einem `Price`. Diese Bedeutung sollte Refactorings, Grenzen und Zeit überdauern. Der einfachste Grund, es zu vermeiden, ist also, weil **es zu generisch ist**. In Wirklichkeit ist **Validierung** nur ein praktisches Ergebnis und nicht der Grund, semantische Typisierung einzuführen.

Du kannst eine natürliche Sprache als Referenz nehmen und überlegen, ob du deine Gedanken einem Fremden so ausdrücken würdest, wie du deinen semantischen Typ formulierst. Aber ehrlich gesagt, weil es zu subjektiv ist, war es für mich nicht geeignet für eine Regel.

Daher können wir eine intuitivere und explizitere Regel aufstellen:

> **Typeinschränkungen sollten deinen semantischen Typ in keinem Sinne antreiben – weder in der Benennung noch in der Existenz.**

**Aber was, wenn `PositiveNumber` im mathematischen Kontext wäre?**

Es mag scheinen, dass `PositiveNumber` **immer noch helfen kann**, Fehler in unserem Code zu vermeiden, zum Beispiel im Kontext einer mathematischen Operation, die Division verwendet:

```kotlin
fun sqrt(x: PositiveNumber): Double
```

Auf den ersten Blick sieht das sauber aus — du kodierst die Domänenregel „keine negativen Zahlen erlaubt“ direkt in den Typ in dem Kontext, der ein solches Konzept „erlaubt“.

Aber ist es ein gültiges Konzept innerhalb einer solchen Domäne? Ich würde vielleicht „ja“ sagen, würde es aber höchstwahrscheinlich unterbewusst vermeiden. Warum?

**Die Bedeutung hängt in einem solchen Fall von der Operation ab, nicht von der Eingabe**. Nimm dies:

```kotlin
fun sqrt(x: PositiveNumber): Foo
```

Die **Operation** (sqrt) ist das, was die Einschränkung _definiert_ — dass die Eingabe nicht negativ sein darf. Die Eingabe selbst, als Zahl, **trägt diese Bedeutung nicht inhärent**. **Ohne den Operationskontext** ist der Typ `PositiveNumber` **nur eine Zahl mit einer Einschränkung** — aber was bedeutet er _wirklich_ für sich allein?

Darüber hinaus assoziieren viele Leute „positive Zahl“ beiläufig mit „nicht-negativ“ und vergessen dabei, dass Null **weder** positiv noch negativ ist, noch beides gleichzeitig. Diese subtile Verwirrung kann zu scheinbar logischem Code führen, der tatsächlich falsch ist. Konzeptionell betrachte diese beiden Operationen:

```kotlin
@JvmInline
value class PositiveNumber(val value: Double) {
    init {
        require(value > 0) { "Wert muss strikt positiv sein" }
    }
}

fun sqrt(x: PositiveNumber): Foo
fun ln(x: PositiveNumber): Foo
```

Stell dir nun vor, du versuchst, diese Funktionen aufzurufen:
```kotlin
val zero = PositiveNumber(0.0) // ❌ wirft IllegalArgumentException
sqrt(zero) // ❌ schlägt fehl, aber mathematisch ist sqrt(0) gültig
ln(PositiveNumber(1.0)) // ✅ funktioniert
```
Beide Funktionen scheinen auf „positiven Zahlen“ zu operieren, aber die genauen Einschränkungen unterscheiden sich: `sqrt` akzeptiert Null (nicht-negativ), während ln strikt positive Werte erfordert. Wenn du versuchst, einen einzigen `PositiveNumber`-Typ für beide wiederzuverwenden, wird eine der Operationen entweder gültige Eingaben ablehnen oder ungültige Eingaben zulassen. **Semantische Typisierung muss den Operationskontext respektieren**, nicht nur den nominalen Wert.

Während das Beispiel sehr spezifisch ist, sollte es dir ein großartiges Beispiel für mögliche Probleme bei der missbräuchlichen Verwendung zu allgemeiner Typen geben, was ein Grund ist, sie nicht einzuführen.

Und das ursprüngliche Problem? Du hast die Einschränkung auf die Eingabe geschoben, aber in der Praxis ist es die _Operation_, die die Einschränkung definiert. Du könntest stattdessen sagen:

```kotlin
fun sqrt(a: Double): Double {
	// es wäre auch mehr als okay, hier nur einen Guard zu haben
	require(a >= 0)
	// ...
}
fun sqrtOrNull(a: Double): Double? {
	if (a > 0) {...}
	return null
}

fun ln(a: Double): Double {
	require(a > 0)
	// ...
}
fun lnOrNull(a: Double): Double? {
	if (a > 0) {...}
	return null
}
```

Bevorzuge Duplizierung gegenüber einer falschen Abstraktion für Fälle, in denen du kein reales Konzept finden kannst.

Daher würde ich eine noch explizitere Regel aufstellen:

> **Operationseinschränkungen sollten deinen semantischen Typ in keinem Sinne antreiben – weder in der Benennung noch in der Existenz.** Wenn dir kein vernünftiger Name einfällt, ohne die Einschränkung zu erwähnen, der zu dieser Regel passen würde – brauchst du höchstwahrscheinlich keinen „semantischen Typ“.

Eine weitere Sache, die zu erwähnen ist, ist, dass wir zum Beispiel eine `Dp`-Klasse haben können, die dichteunabhängige Pixel darstellt, und dennoch Einschränkungen haben können, die durch die Operation (Nutzungskontext) definiert sind:
```kotlin
fun setDividerHeight(value: Dp) {
	require(value != Dp.ZERO)
	// ...
}
```
Die Einführung einer Art `DividerHeightDp` mit einer solchen Bedingung ist Overkill und fällt im Grunde unter das `PositiveNumber`-Problem.

Aber du magst sagen:

> Aber was, wenn wir `PositiveNumber` erlauben, einfach weil es eine hilfreiche Einschränkung erzwingt und ich keine Mehrdeutigkeit in meinem Code dafür habe?

Und das ist vielleicht großartig! Aber wo ziehen wir in der Realität die Grenze?

Warum dort aufhören?

- Warum nicht auch `NegativeNumber` haben?
- `NonZeroNumber`?
- `NonEmptyList`, `OneElementList`, `AtLeastThreeItemsList`?
- `ShortString`, `UppercaseString`?

Ich bin absolut sicher, dass du zumindest einige der gegebenen Optionen nicht in deinem Code sehen möchtest, aber ohne eine klare Regel ist es leicht, bis zu einem gewissen Grad darauf hereinzufallen.

Und sobald du diesen Weg einschlägst, **wird jede Regel ein Kandidat für einen semantischen Typ** — und das ist das Problem. Du modellierst nicht mehr _Konzepte_ — du modellierst _Bedingungen_. Und Bedingungen sind keine Identitäten.

An diesem Punkt entwirfst du kein reichhaltiges Domänenmodell. Du baust eine Constraint-Validierungs-Bibliothek, die wie deine Domäne geformt ist. Und das ist ein völlig anderes Ziel — eines, das mehr Komplexität als Klarheit einführt.

Stellen wir also eine vernünftige Regel auf, ohne uns auf eines unserer „inneren Gefühle“ zu verlassen:

> **Wenn der semantische Typ nicht allein als bedeutungsvolles Konzept ohne seinen zugrunde liegenden Typ stehen kann, ist er wahrscheinlich ein schlechter semantischer Typ.**

Das ist auch der Grund, warum die Einführung von `DividerHeight(value: Dp)` anstelle von `DividerHeightDp(value: Int)` – eine schlechte Idee ist. Es würde einfach jedes Mal ausgepackt werden, was eine Menge unnötigen Boilerplate in unserem Code erzeugt.

### Modellierung von Ausgaben

Wir haben genug Zeit damit verbracht, über semantische Typisierung für **Eingaben** zu sprechen — Typen, die Daten verpacken, die _in_ unsere Domäne gehen. Aber was ist mit der **entgegengesetzten Richtung**? Können semantische Typen auch für die Modellierung von **Ausgaben** nützlich sein?

Betrachten wir das folgende Beispiel:

```kotlin
val textContents: FileTextContents
```

Warum ist das schlecht? Zuerst einmal verrät es die Quelle! Aber warte.. warum ist das ein Problem?

Fügen wir ähnliche Varianten hinzu, um dieses Problem besser zu verstehen:

- `FileTextContents`
- `HttpTextContents`
- `UserInputTextContents`
- ..wo hören wir auf?

Es ist völlig in Ordnung, Folgendes zu haben:

```kotlin
@JvmInline
value class FileSize(private val bytesAmount: Long) {
	val bytes: Long get() = bytesAmount
	val kilobytes: Long get() = ...
	// ...
}

class File (... ) {
	// ...

	sval size: FileSize get() = ...

	// ...
}
```

In diesem Beispiel geht es nicht wirklich darum, die Quelle der Daten zu nennen, sondern vielmehr um ein funktionales Konzept an sich — **Dateigröße**. Die Idee von FileSize **repräsentiert ein tatsächliches Konzept**: eine Menge von Bytes, benannt nach unserer Domäne. Ob es aus einer Datei, einem Speicherpuffer oder einem Netzwerkstrom kam — seine _Bedeutung_ bleibt dieselbe. FileSize spiegelt ein Konzept wider, das für sich allein steht.

Daher macht eine Benennung wie `DownloadedFileSize` keinen Sinn. Frag dich:

> Spielt die _Quelle_ dieses Strings wirklich eine Rolle für die Geschäftslogik?

So etwas einzuführen mag sich „beschreibend“ anfühlen, aber in Wirklichkeit verdrahtest du Kontext fest, der nicht zum Kernkonzept gehört. Du nimmst ein neutrales, wiederverwendbares Konzept — wie „Text“ oder „Größe“ — und schränkst seinen Umfang unnötig ein. Dies schafft Fragmentierung, Verwirrung und unnötigen Aufwand in der API, eines ohne Grund in das andere zu konvertieren.

Und ich habe das Gefühl, dass wir es nicht mögen, eines in das andere zu mappen 🌚

> **Benenne dein Konzept eng genug, um auf einen Blick verstanden zu werden, aber ohne Übertreibung.**

## Fazit
Semantische Typisierung und insbesondere Value Objects sind mächtige Werkzeuge, um Absicht, Validierung und Domänenbedeutung in Typen zu drängen. Verwende sie, wenn ein Konzept Teil deiner Domänensprache ist, wenn Invarianten zentralisiert werden müssen oder wenn eine API-Grenze eine klarere Absicht benötigt. Vermeide sie, wenn die Einschränkung durch eine Operation statt durch das Konzept selbst definiert ist oder wenn ein Typ zu generisch wäre und damit an Bedeutung verlieren würde. Bevorzuge sichere Konstruktionsmuster (Factories, die Validierungsergebnisse zurückgeben) und etabliere einfache Teamregeln, damit die Vorteile skalieren, ohne unnötigen Aufwand zu erzeugen.
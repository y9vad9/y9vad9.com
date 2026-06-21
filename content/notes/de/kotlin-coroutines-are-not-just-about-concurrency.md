---
title: Kotlin Coroutinen gehen über die reine Nebenläufigkeit hinaus
preview: "Ist Nebenläufigkeit der einzige Anwendungsbereich für Kotlin Coroutinen? Entdecken Sie die vielseitigen Anwendungen von Coroutinen jenseits asynchroner Aufgaben, von grundlegenden Primitiven bis hin zu fortgeschrittenen Techniken in Sequenzen, tiefer Rekursion und UI-Frameworks wie Jetpack Compose."
date: 2023-10-1
coverImage: "attachments/kotlin-coroutines-are-not-just-about-concurrency-cover.webp"
parents: ["Kotlin"]
---
Jedes Mal, wenn Sie von Kotlin Coroutinen hören, denken Sie wahrscheinlich an eine einfache, prägnante und leistungsstarke Lösung für die Bearbeitung asynchroner Aufgaben, wie zum Beispiel Netzwerkanfragen. Aber ist das ihr _einziger Zweck_? Betrachten wir die Verwendung von Kotlin Coroutinen jenseits der Nebenläufigkeit.

## Kotlin Coroutinen Primitive
Beginnen wir damit, zu verstehen, wie der zugrunde liegende Mechanismus von Coroutinen funktioniert. Wenn wir uns die Kotlin Coroutinen Primitive ansehen, handelt es sich nur um ein paar Klassen und Funktionen:
- `Continuation`
- `CoroutineContext`
- `suspendCoroutine`
- `createCoroutine`
- `startCoroutine`

Das ist alles, was wir in unserem `kotlin-stdlib` haben. Aber wofür werden sie verwendet? Tauchen wir tiefer in die Funktionsweise von Kotlin Coroutinen ein.
### `Continuation`
Continuation ist lediglich ein Interface mit zwei Mitgliedern: `context` und `resumeWith`:
```kotlin
public interface Continuation<in T> {
    public val context: CoroutineContext
    public fun resumeWith(result: Result<T>)
}
```
Was tut es und welchen Zweck hat es? `Continuation` – ist wörtlich die primäre _Coroutine_. Es ist wie ein verbesserter Callback mit der Fähigkeit, zusätzliche Informationen zu verbreiten und ein nützliches Ausführungsergebnis an die Coroutine zu liefern.

Wir haben noch nicht über `CoroutineContext` gesprochen, betrachten wir vorerst nur `resumeWith`.

### `resumeWith`
Wie jeder andere Callback ist dies eine Funktion, die aufgerufen wird, wenn die Coroutine ihre Arbeit beendet. Sie verwendet `kotlin.Result`, um alle in der Coroutine auftretenden Ausnahmen sicher weiterzuleiten.

Wir können also unsere Nebenläufigkeitslogik mithilfe von `Continuation` auf folgende Weise erstellen:
```kotlin
suspend fun executeNetworkRequest(): String =
	suspendCoroutine { continuation ->
		thread {
			continuation.resumeWith(someBlockingRequest())
		}
	}
```
> `suspendCoroutine` – ist eine Brücke zwischen Kotlin Coroutinen-Code und nicht-Coroutinen-basiertem Code.

Oder verwenden Sie eine bestehende asynchrone (Pseudocode):
```kotlin
suspend fun executeNetworkRequest(): String =
	suspendCoroutine { continuation ->
		apiService.getSomething()
			// onSuccess & onFailure sind Callbacks
			.onSuccess(continuation::resume)
			.onFailure(continuation::resumeWithException)
			.executeAsync()
	}
```
> `Continuation<in T>.resume(..)` ist die Erweiterung, um die Übergabe von `kotlin.Result` jedes Mal zu vermeiden.

Wir können also nicht nur unsere Nebenläufigkeitslogik implementieren, sondern auch bestehende nutzen und sie mit Kotlin Coroutinen zum Laufen bringen.

### `startCoroutine`
Wir können auch Suspend-Funktionen aus nicht-Suspend-Kontexten mit `startCoroutine` starten. In Kotlin wird dies immer am Ende verwendet, wenn Ihre `main`-Funktion `suspend` ist.

> `kotlinx.coroutines` verwendet es auch, um Coroutinen auszuführen, aber der Mechanismus dort ist natürlich viel komplexer.

```kotlin
import kotlin.coroutines.*

fun main() {
	val operation: suspend () -> Unit = ::a
	operation.startCoroutine(
		object : Continuation<Unit> {
			// Wir werden später darüber sprechen
			override val coroutineContext = EmptyCoroutineContext

			// Wird aufgerufen, wenn die Coroutine ihre Arbeit beendet hat
			override fun resumeWith(result: Result<Unit>) {
				println(
					if(result.isSuccess)
						"Erfolgreich abgeschlossen"
					else "Fehler aufgetreten: ${result.exceptionOrNull()}"
				)
			}
		}
	)
}

suspend fun a() {...}
```
> Aber natürlich können Sie Suspend-Funktionen aus `kotlinx.coroutines` nicht einfach auf diese Weise aufrufen, wenn Sie Coroutinen ausführen.

### `CoroutineContext`
Jetzt kommen wir zu einem weiteren Mitglied von `Continuation` – `CoroutineContext`. Wozu dient es?

`CoroutineContext` ist ein Provider, der die benötigten Daten an die Coroutine weitergibt. In der realen Welt geht es dabei normalerweise um die Übergabe von Parametern über eine komplexe Kette von Coroutinen hinweg.
> Um es klarer auszudrücken, CoroutineContext in `kotlinx.coroutines` steht für [strukturierte Nebenläufigkeit](https://kotlinlang.org/docs/coroutines-basics.html#structured-concurrency).

#### Einfaches Beispiel
Erstellen wir aus unserem vorherigen Beispiel für `startCoroutine` Code mit der Fähigkeit, Werte aus `CoroutineContext` abzurufen:
```kotlin
import kotlin.coroutines.*

// definieren wir unseren Container für Daten, die wir innerhalb der Coroutine benötigen
// er sollte immer von 'CoroutineContext.Element' erben
data class ExecutionContext(val someInt: Int) : CoroutineContext.Element {
    override val key = EXECUTION_CONTEXT_KEY
}

// definieren wir einen typensicheren Schlüssel, mit dem wir unseren Wert erhalten
val EXECUTION_CONTEXT_KEY = object : CoroutineContext.Key<ExecutionContext> {}

// definieren wir den Coroutine-Kontext, den wir an Continuation übergeben werden
private val myCoroutineContext = object : CoroutineContext {
	private val values = mapOf<CoroutineContext.Key<*>, CoroutineContext.Element>(
        EXECUTION_CONTEXT_KEY to ExecutionContext(10000)
    )

	override operator fun <E : CoroutineContext.Element> get(key: CoroutineContext.Key<E>): E? {
		return values[key] as? E
	}

	// .. wir lassen andere Funktionen der Einfachheit halber weg
}

suspend fun a() {
	// hier rufen wir den Wert aus dem Coroutine-Kontext ab
	// coroutineContext ist Compiler-intrinsisch, kann nur
	// aus der Suspend-Welt aufgerufen werden
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
						"Erfolgreich abgeschlossen"
					else "Fehler aufgetreten: ${result.exceptionOrNull()}"
				)
			}
		}
	)
}
```

> `CoroutineContext.Element` – ist der Abstrakt, der zum Speichern von Elementen in `CoroutineContext` verwendet wird.
>
> `CoroutineContext.Key` – ist der Bezeichner von `CoroutineContext.Element`.

Sie können diesen Code [hier](https://pl.kotl.in/0AZBcZ4MM) ausprobieren.
#### Beispiel aus der Praxis

Stellen wir uns vor, wir haben unseren API-Dienst. Normalerweise benötigen wir eine Autorisierungsebene, daher betrachten wir das nächste Beispiel (als solches habe ich gRPC genommen):
```kotlin
// definieren wir ein Element, das in `CoroutineContext` bestehen bleibt
data class AuthorizationContext(
    val accessHash: String?,
    val provider: AuthorizationProvider,
) : CoroutineContext.Element {
    companion object Key : CoroutineContext.Key<AuthorizationContext>

    override val key: CoroutineContext.Key<*> = Key
}

// jetzt definieren wir unseren Interceptor
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

`CoroutineContext` in `kotlinx.coroutines` ist buchstäblich nur eine `Map<K : CoroutineContext.Key, V : CoroutineContext.Element>` (genauer gesagt, es ist eine [ConcurrentHashMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentHashMap.html) auf der JVM, zum Beispiel), genau wie in unserem obigen Beispiel. Aber, wenn wir über `kotlinx.coroutines` sprechen, wird es an alle Kind-Coroutinen innerhalb der gewünschten Coroutine weitergegeben (einen solchen Mechanismus hatten wir nicht).

So können wir es jetzt in Kind-Coroutinen abrufen:
```kotlin
suspend inline fun provideAuthorization(block: (UserId) -> Unit) {
	val authContext = coroutineContext[AuthorizationContext]
	authContext.accessHash ?: throw StatusException(Status.UNAUTHORIZED)

	val userId = authContext.provider.provide(authContext.accessHash)
	return block(userId)
}
```

> Interessante Tatsache: [coroutineContext](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/coroutines/Continuation.kt#L157) ist die einzige Eigenschaft in Kotlin, die den `suspend`-Modifikator hat. 👀

Für gRPC müssen wir auch unseren Interceptor registrieren und unsere RPCs schreiben. Aber die Idee dieser Lösung für gRPC ist einfach – Logik entkoppeln und die Entwicklererfahrung vereinfachen.

> Für Java verwendet gRPC [ThreadLocal](https://docs.oracle.com/javase/8/docs/api/java/lang/ThreadLocal.html), daher können wir `CoroutineContext` auch als Alternative zu `ThreadLocal` betrachten. Wir können `ThreadLocal` innerhalb von Coroutinen nicht verwenden, da eine Coroutine normalerweise nicht mit einem bestimmten Thread verknüpft ist (insbesondere, wenn wir über `withContext` sprechen). Coroutinen werden eher auf einem anderen Thread fortgesetzt (außerdem können verschiedene Coroutinen auf einem einzigen Thread ausgeführt werden).

Aber bedeutet das nicht, dass der einzige Grund, warum Coroutinen existieren, die Nebenläufigkeit ist? Lassen Sie es mich erklären.

## `Sequence`
Eines der häufigsten Beispiele ist die – `kotlin.sequences.Sequence<T>`. Kurz gesagt, es ist eine faule Sammlung, die nur dann iteriert, wenn Sie Elemente konsumieren. Sie können mehr darüber [hier](https://kotlinlang.org/docs/sequences.html) lesen.

Wenn Sie jemals die `SequenceScope`-Quellen betrachtet haben, verwendet sie unter der Haube Suspend-Funktionen:
```kotlin
@RestrictSuspension
public abstract class SequenceScope<in T> internal constructor() {
    /**
     * Liefert einen Wert an den erstellten [Iterator] und suspendiert
     * bis der nächste Wert angefordert wird.
     */
    public abstract suspend fun yield(value: T)

    // ... andere
}
```

> `@RestrictSuspension` verbietet Konsumenten, nicht-Mitglieds-Suspend-Funktionen aufzurufen.

Die Idee ist also, dass Elemente faul konsumiert werden. Sie können sie als reguläre Sammlungen verwenden und die Vorteile der faulen Iteration nutzen.

Aber wie funktioniert es unter der Haube? Werfen wir einen Blick auf die Implementierungsquellen:
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
			step.resume(Unit) // WICHTIG: Es beginnt die Ausführung des nächsten Yields
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
		result.getOrThrow() // wirft einfach die Ausnahme erneut, falls vorhanden
		state = State_Done
	}

	override val context: CoroutineContext
		get() = EmptyCoroutineContext
}
```

   > `COROUTINE_SUSPENDED` ist eine spezielle Konstante, die intern vom Kotlin-Compiler verwendet wird, um die Suspendierung und Wiederaufnahme von Coroutinen zu verwalten. Es ist nichts, womit Entwickler normalerweise direkt interagieren, sondern dient als internes Signal innerhalb des Coroutinen-Mechanismus.

Sieht etwas schwierig zu lesen aus, nicht wahr? Gehen wir Schritt für Schritt vor:
1. Zuerst beginnen wir mit Zuständen. Wir haben die nächsten Zustände, lassen Sie uns kurz darüber sprechen:
	- **State_NotReady**: Der Iterator ist derzeit nicht bereit, ein Element bereitzustellen. Er wartet möglicherweise auf eine Operation oder weitere Verarbeitung, um ein Element verfügbar zu machen.
	- **State_ManyNotReady**: Der Iterator ist darauf vorbereitet, mehrere Elemente bereitzustellen, aber sie sind nicht sofort verfügbar. Er wartet auf ein Signal, dass Elemente zum Verbrauch bereit sind (im Grunde wartet er auf einen Terminaloperator).
	- **State_ManyReady**: Der Iterator ist jetzt bereit, mehrere Elemente bereitzustellen. Er kann sofort das nächste Element aus der Sequenz liefern.
	- **State_Ready**: Der Iterator hat ein einzelnes Element bereit, das bereitgestellt werden kann. Er ist darauf eingestellt, das Element sofort auf Anfrage zu liefern.
	- **State_Done**: Der Iterator hat keine weiteren Elemente mehr bereitzustellen. Er hat seine Aufgabe, Elemente aus der Sequenz zu erzeugen, abgeschlossen. Diesen Zustand erreichen wir, wenn wir `SequenceBuilder` verlassen.
	- **State_Failed**: Etwas Unerwartetes ist passiert, und der Iterator ist auf ein Problem gestoßen. Normalerweise sollte dies nicht passieren.
2. `hasNext` gibt je nach Zustand einen Wert oder eine Reihe von Werten zurück, wenn er bereit ist, zu konsumieren. Darüber hinaus startet er die Ausführung der Sequenz bei jeder Iteration innerhalb von `while`. Wenn also `State_NotReady` vorliegt, wird es durch Ausführen der nächsten Yields bereit gemacht.
3. Die Funktion `next` ruft das nächste Element aus dem Iterator basierend auf seinem aktuellen Zustand ab (ähnlich wie bei `hasNext`). Wenn `next` ohne `hasNext` aufgerufen wurde, können Sie `nextNotReady()` erreichen. In anderen Situationen wird einfach der Wert zurückgegeben.
4. Die `yield`-Funktion ändert lediglich die Zustände der Sequenziterator-Implementierung. Wenn neue Elemente hinzugefügt werden, wechselt sie zu `State_Ready`. Die Verwendung von `suspendCoroutineUninterceptedOrReturn` suspendiert die Coroutine (Ausführung) und setzt sie später fort. Sie wird gestartet, wenn die vorherige Coroutine (Suspend-Punkt) beendet ist.

Um meine Erklärung abzuschließen, beenden wir sie einfach damit, wie wir die gleiche Funktionalität nur mit Callbacks realisieren könnten:

```kotlin
val sequence = sequence {
    yield(1) {
        yield(2) {
            yield(3) { /* ... */ }
        }
    }
}
```

Aber es sieht etwas schwierig zu lesen aus, nicht wahr? Deshalb sind Coroutinen in dieser speziellen Situation nützlich.

Am Ende sieht es doch gar nicht so komplex aus, oder?

## `DeepRecursiveScope`
Nun wollen wir uns einen weiteren Anwendungsfall für Kotlin Coroutinen ansehen – `DeepRecursiveScope`. Wie Sie wahrscheinlich wissen, haben wir normalerweise, wenn eine bestimmte Funktion sich selbst aufruft, eine Wahrscheinlichkeit, einen `StackOverflowError` zu erhalten, da jeder Aufruf dazu beiträgt, unseren Stack zu füllen.

> Zu diesem Zweck existiert zum Beispiel auch die Sprachkonstruktion `tailrec`. Der Unterschied ist, dass `tailrec` keine Verzweigungen (bedingte Prüfungen) mit Aufrufen anderer Funktionen haben kann.
>
> Sie können mehr darüber [hier](https://kotlinlang.org/docs/functions.html#tail-recursive-functions) lesen.

`DeepRecursiveScope` stützt sich also nicht auf den traditionellen Stack-Flow, sondern nutzt alle Funktionen, die Coroutinen bieten. Um es besser zu verstehen, betrachten wir das klassische Beispiel mit Fibonacci-Zahlen:
```kotlin
val fibonacci = DeepRecursiveFunction<Int, Int> { x ->
    when {
        x < 0 -> 0
        x == 1 -> 1
        else -> callRecursive(x - 1) + callRecursive(x - 2)
    }
}

println(fibonacci(12)) // Ausgabe: 144
```

Für ein komplexeres Beispiel können Sie die [kdoc](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/util/DeepRecursive.kt#L40) konsultieren.

Wir werden uns nicht mit den genauen Implementierungsdetails von `DeepRecursiveScope` aufhalten (Sie können sie [hier](https://github.com/JetBrains/kotlin/blob/7a7d392b3470b38d42f80c896b7270678d0f95c3/libraries/stdlib/src/kotlin/util/DeepRecursive.kt#L131) nachlesen), da sie die gleiche Idee wie `Sequence` mit zusätzlichem Verhalten zur Unterstützung der bereitgestellten Mechanismen haben, aber lassen Sie uns diskutieren, wie Kotlin Coroutinen dieses spezielle Problem lösen. Außerdem gibt es einen [sehr guten Artikel darüber](https://elizarov.medium.com/deep-recursion-with-coroutines-7c53e15993e3) von Roman Elizarov.

### Coroutinen intern
Wie genau löst es das Problem? Wie ich bereits erwähnt habe, sind Coroutinen von [CPS (Continuation Passing Style)](https://en.wikipedia.org/wiki/Continuation-passing_style) inspiriert, aber es ist nicht genau das, was der Kotlin-Compiler tut, um Coroutinen so effizient zu handhaben.

Der Kotlin-Compiler verwendet eine Kombination von Optimierungen, um den Coroutinen-Stack und die Ausführung effizient zu verwalten. Schauen wir uns an, was genau er tut:
- **Compiler-Transformationen**: Der Kotlin-Compiler generiert einen Zustandsautomaten, ähnlich dem, was wir in den Implementierungsdetails von [Sequenzen](#Sequence) gesehen haben. Es beseitigt nicht alle Stack-Aufrufe, aber reduziert sie ausreichend, um keinen `StackOverflowError` zu erhalten.
- **Heap-Allokation von Continuations**: In einer traditionellen Callback-Kette schiebt jeder Funktionsaufruf Daten auf den Call-Stack. Wenn die Kette tief ist, kann dies viel Stack-Speicher verbrauchen. Beim Coroutine-Ansatz wird, wenn eine Coroutine suspendiert wird, ihre Continuation als Objekt auf dem Heap gespeichert. Dieses Continuation-Objekt enthält die notwendigen Informationen (Stack, Dispatcher usw.), um die Ausführung der Coroutine fortzusetzen. Diese Heap-Speicherung ermöglicht eine viel größere Kapazität, tiefe Aufrufketten zu verarbeiten, ohne das Risiko eines Stack-Überlaufs.

Der genaue Mechanismus von Coroutinen ist der folgende:
1. **Serialisierung**: Der Stack-Zustand der suspendierten Coroutine wird in einem Heap-allokierten Continuation-Objekt gespeichert.
2. **Wiederaufnahme**: Wenn die Wiederaufnahme bereit ist, richtet das Framework einen nativen Stack ein, um den erfassten Zustand nachzubilden.
3. **Speicherkopie**: Der serialisierte Stack-Zustand wird vom Continuation-Objekt in den nativen Stack kopiert.
4. **Kontextkonfiguration**: Der Ausführungskontext wird an den ursprünglichen Zustand angepasst.
5. **Programmzeiger**: Der Programmzeiger wird auf den gespeicherten Wert für die korrekte Anweisung gesetzt.
6. **Aufruf**: Der Continuation-Code wird mit CPS aufgerufen, wodurch die Ausführung fortgesetzt wird.

> Die Stack-Wiederherstellung hilft uns auch bei der Wiederaufnahme auf verschiedenen Threads, da diese nichts über den Stack unserer Coroutine wissen.

So können wir von nun an verstehen, wie Coroutinen intern funktionieren. Gehen wir zu anderen Beispielen über, in denen Kotlin Coroutinen über die Nebenläufigkeit hinaus verwendet werden.

## Jetpack Compose
Wenn Sie jemals mit Compose gearbeitet und beispielsweise Zeigerereignisse verarbeitet haben, haben Sie wahrscheinlich bemerkt, dass einige Hacks aus Coroutinen verwendet werden, um auf Updates zu warten:
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
Wie Sie sehen, ist der Scope, der zur Verarbeitung von Zeigerereignissen verwendet wird, mit `@RestrictsSuspension` markiert. Wenn wir die bereitgestellte Dokumentation konsultieren, sehen wir Folgendes:
```markdown
Dies ist ein eingeschränkter Suspendierungsbereich. Code in diesem Bereich wird
immer un-dispatched aufgerufen und darf nur für Aufrufe von
[awaitPointerEvent] suspendiert werden. Diese Funktionen werden synchron fortgesetzt und der Aufrufer kann das Ergebnis
**vor** dem nächsten await-Aufruf mutieren, um die nächste Stufe der Eingabeverarbeitungspipeline zu beeinflussen.
```

`awaitPointerEvent` wird mit Kotlin-Primitiven verarbeitet, ohne `kotlinx.coroutines`. Da wir in einer solchen Situation keine `kotlinx.coroutines`-Logik benötigen (es ist im Grunde nur ein Callback, der nach einer Benutzeraktion vom Main-Looper-Thread aufgerufen wird).

## Fazit
Zusammenfassend hat dieser Artikel verschiedene Facetten von Kotlin Coroutinen beleuchtet und ihre Vielseitigkeit jenseits traditioneller Nebenläufigkeitsaufgaben hervorgehoben. Wir haben uns mit den inneren Mechanismen der Coroutinen-Primitive befasst, ihre Verwendung in Sequenzen und komplexen Problemlösungsszenarien wie tiefer Rekursion diskutiert und reale Beispiele untersucht, die ihre breite Anwendbarkeit demonstrieren. Der Titel "Coroutinen gehen über die reine Nebenläufigkeit hinaus" spiegelt treffend die vielfältigen Fähigkeiten wider, die Kotlin Coroutinen in der modernen Softwareentwicklung bieten.

Fühlen Sie sich frei, Ihr Fachwissen zwanglos in den Kaffeepausen-Chat einzubringen!
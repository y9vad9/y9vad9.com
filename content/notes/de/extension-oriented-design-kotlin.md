---
title: Erweiterungsorientiertes Design in Kotlin
preview: "Was erweiterungsorientiertes Design in Kotlin bedeutet: Der Kern eines Typs bleibt klein und stabil, alles Weitere wird über Erweiterungen ausgedrückt."
date: 2022-11-15
coverImage: "attachments/extension-oriented-design-cover.webp"
parents: ["Kotlin", "Softwaredesign"]
---
Mit der Entwicklung der Programmierung entwickelten sich auch die Arten, wie wir Code strukturieren. Frühe Programme waren einfache, geradlinige Abfolgen von Anweisungen, wobei die Wiederverwendung hauptsächlich durch Kopieren und Einfügen erreicht wurde. Im Laufe der Zeit führte dies zur Einführung von Abstraktionen wie Unterprogrammen, Prozeduren und Funktionen und später zu Ansätzen auf höherer Ebene wie der objektorientierten Programmierung.

Der Fortschritt bleibt nicht stehen, und jede Sprache bringt ihre eigenen Konventionen mit, die prägen, wie Code geschrieben und gelesen wird. Heute besprechen wir das erweiterungsorientierte Design in Kotlin – was es ist und warum Erweiterungen (Extensions) mehr sind als nur ein Workaround für Klassen, die einem nicht gehören.

## Erweiterungen in Kotlin
Beginnen wir mit einer kurzen Einführung für Leser, die neu bei Kotlin sind – oder es nicht täglich nutzen, aber dennoch neugierig sind.

> Eine **Kotlin-Erweiterung** (Extension) ist ein Sprachmerkmal, mit dem Sie einem **bestehenden Typ neues Verhalten hinzufügen können, ohne ihn zu ändern oder von ihm zu erben**.

In den meisten objektorientierten Sprachen ist der klassische Weg zur Funktionserweiterung die **Vererbung**. Dies funktioniert gut, solange Ihnen die Klasse gehört oder Vererbung keine Option ist – zum Beispiel, wenn ein Typ ein Primitiv, `final`, `sealed` ist oder bereits zu viele Implementierungen hat, um ihn sinnvoll zu erweitern.

In Java wird diese Einschränkung normalerweise durch die Einführung sogenannter *Helper*- oder *Utils*-Klassen gelöst (die Benennung variiert, die Idee nicht). Beispielsweise sieht das Hinzufügen einer Funktion zum Finden des maximalen Elements in einer Liste oft so aus:
```java
public final class ListUtils {
	private ListUtils() {}
	
	public static Integer max(List<Integer> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }

        int max = values.get(0);

        for (int i = 1; i < values.size(); i++) {
            int value = values.get(i);
            if (value > max) {
                max = value;
            }
        }

        return max;
    }
}
```

Technisch gesehen könnte man eine `List` in einer anderen Klasse kapseln, um zusätzliche Funktionalität über das [Delegationsmuster](https://de.wikipedia.org/wiki/Delegationsprinzip) bereitzustellen. In der Praxis wird dies jedoch selten getan. Stellen Sie sich vor, Sie erstellen eine Liste mit `List.of(...)` und kapseln sie dann erneut in `FooList<E>`, nur um eine einzige zusätzliche Operation zu erhalten – dies führt zu unnötigem Aufwand und oft zu zusätzlichen Allokationen bei sehr geringem Nutzen. Infolgedessen bleiben statische Hilfsmethoden der dominierende Ansatz. Das funktioniert zwar, bringt aber Kompromisse mit sich.

Man muss wissen, dass `ListUtils` existiert, sich an seinen Namen erinnern und hoffen, dass er einer vorhersehbaren Namenskonvention folgt. In echten Codebasen neigen diese Klassen dazu, groß zu werden, sich im Laufe der Zeit zu vervielfältigen und in mehrere Varianten zu fragmentieren. Das Finden einer existierenden Hilfsfunktion wird oft zu einem Suchproblem, und doppelte Implementierungen sind an der Tagesordnung, einfach weil jemand nicht wusste, dass die Funktionalität bereits existierte.

Kotlin adressiert dies mit **Erweiterungsfunktionen** (Extension Functions). Anstatt nach einer Hilfsklasse zu suchen, suchen Sie nach Verhalten, das *auf dem Typ selbst* definiert ist:
```kotlin
fun Iterable<T : Comparable<T>>.max(): T { /* ... */ }
```
![Code-Vorschläge Vorschau](attachments/extension-oriented-design-extension-showcase.webp)

Dies macht das Auffinden erheblich einfacher. Die Funktionalität wird im Vokabular des Typs ausgedrückt, zu dem sie gehört, anstatt hinter einem willkürlichen Namen einer Hilfsklasse verborgen zu sein.

Davon abgesehen werden Kotlin-Erweiterungen manchmal lediglich als eine Möglichkeit wahrgenommen, Sprachbeschränkungen zu umgehen. Ein häufiges Beispiel ist die Unfähigkeit, ein *finales* Mitglied in einem `interface` zu deklarieren, obwohl einige Funktionen von Natur aus final sind – wie diejenigen, die auf `reified` Typparametern basieren:
```kotlin
interface Serializer {
  fun <T> encode(kClass: KClass<T>, value: T): String
}

inline fun <reified T> Serializer.encode(value: T): String {
  return encode(T::class, value)
}
```

Hier soll die Inline-Erweiterung an die **zugrunde liegende Funktion delegieren**, ohne neues Verhalten hinzuzufügen. Ihr Zweck ist rein die Bereitstellung einer bequemeren Nutzung auf der Aufrufseite, nicht die Änderung dessen, was die ursprüngliche Funktion tut. Selbst wenn die Sprache es erlauben würde, sie zu überschreiben, wäre dies unangemessen, da es diese Delegation und den erwarteten Vertrag verletzen könnte, wenn jemand sie auf unerwartete Weise überschreiben würde.

Aber ist das der einzige Nutzen von Erweiterungen? Nicht wirklich.

## Trennung von Kern und Fähigkeit
Nun zum interessantesten Teil – wie Erweiterungen über die Umgehung von Sprachbeschränkungen hinaus helfen. Aber beginnen wir mit einer Art Definition:
> **Erweiterungsorientiertes Design** ist ein Ansatz, bei dem die **Kernfähigkeiten** eines Typs minimal und stabil gehalten werden, während **abgeleitetes, kombiniertes oder komfortables Verhalten** über Erweiterungen ausgedrückt wird – unabhängig davon, ob einem der Typ gehört oder nicht.

Obwohl Erweiterungen oft für Klassen verwendet werden, die uns nicht gehören, ist Eigentum nicht der entscheidende Punkt. Der Punkt ist die **Trennung dessen, was ein Typ *ist*, von dem, was mit ihm *gemacht werden kann***.

Ein gutes Beispiel ist `Flow<T>` in `kotlinx.coroutines`. Das `Flow`-Interface ist bewusst minimal gehalten und um eine **einzige Kernfähigkeit** herum aufgebaut: `collect`. Alles andere leitet sich davon ab.

Konzeptionell läuft das Interface auf Folgendes hinaus:
```kotlin
public interface Flow<out T> {
    suspend fun collect(collector: FlowCollector<T>)
}
```

Alle übergeordneten Operationen – `map`, `filter`, `combine`, `flatMapLatest` und viele andere – sind als **Erweiterungen** implementiert, die dieses eine Primitiv wiederverwenden, anstatt das Interface aufzublähen.

Zum Beispiel ist `map` im Wesentlichen so definiert:
```kotlin
public inline fun <T, R> Flow<T>.map(
    crossinline transform: suspend (T) -> R
): Flow<R> =
    flow {
        collect { value ->
            emit(transform(value))
        }
    }
```
Erweiterungsorientiertes Design macht diese Struktur explizit. Der Kern bleibt klein und lesbar; abgeleitetes Verhalten wird klar darüber geschichtet. Dies wiederum vereinfacht das Verständnis der Codebasis und das Nachdenken über die Abstraktion.

Es adressiert auch ein umfassenderes Problem, das Abstraktionen oft mit sich bringen: unkontrollierte Vererbung. Wenn Verhalten durch überschreibbare Mitglieder ausgedrückt wird, wird es schwieriger, darüber nachzudenken, was tatsächlich zur Laufzeit passiert. Ein Bug verwandelt sich oft in ein Ratespiel im Code einer endlosen Vererbungskette – was hätte überschrieben werden können und wo?

Erweiterungen vermeiden diese Klasse von Problemen durch ihr Design. Sie können nicht überschrieben werden und können daher das Verhalten nicht stillschweigend verändern. Dies ist keine Einschränkung, sondern eine beabsichtigte Eigenschaft: Verträge bleiben stabil, abgeleitetes Verhalten bleibt vorhersehbar und die Anzahl der Dinge, die die Ausführung beeinflussen können, wird reduziert.

Infolgedessen helfen Erweiterungen nicht nur bei der Strukturierung von Code – sie helfen dabei, das Vertrauen in die Abstraktion selbst zu bewahren.

Und dies ist keine Technik, die nur für Bibliotheken gedacht ist – Sie können denselben Ansatz in Ihrem eigenen Code anwenden. Ein paar allgemeine Richtlinien:
- Definieren Sie eine kleine, stabile Kernfähigkeit.
- Drücken Sie alles andere als Erweiterungen aus, die darauf aufbauen.
- Lassen Sie das Verhalten wachsen, ohne die Kernabstraktion aufzublähen.

In diesem Modell sind Erweiterungen keine „zusätzlichen Helfer". Sie sind die primäre Art und Weise, wie Verhalten zusammengesetzt wird, während der Kern minimal und explizit bleibt.

> Wenn Sie neugierig auf andere Beispiele für diesen Ansatz sind, können Sie sich auch [kotlin.Result](https://github.com/JetBrains/kotlin/blob/master/libraries/stdlib/src/kotlin/util/Result.kt#L173) und die Ktor-Quelltexte ansehen. Im Allgemeinen verwenden die gesamte Standardbibliothek, `kotlinx.coroutines`, Ktor und andere offizielle Bibliotheken diesen Ansatz. Eine großartige Inspirationsquelle!


## Ab in die Tiefe
Versuchen wir, selbst etwas zu bauen, um diese Idee wirklich zu festigen. Stellen Sie sich vor, Sie müssten eine kleine und einfache Caching-Bibliothek entwickeln. Wie würden Sie unter Berücksichtigung des **erweiterungsorientierten Designs** vorgehen?

Zuerst müssen wir die **Kernfunktionalität** identifizieren – den minimalen Satz an Operationen, den jeder Cache unterstützen muss. Im Kern macht ein Cache zwei Dinge:
1. Einen Wert über einen Schlüssel abrufen.
2. Einen Wert unter einem Schlüssel speichern.

Alles andere ist lediglich Komfort, der darüber geschichtet wird. Das ergibt ein klares, minimales Interface:
```kotlin
interface Cache<K : Any, V : Any> {
    operator fun get(key: K): V?
    // Weist einem [key] einen [value] zu.
    // Wenn [value] null ist, wird er aus dem Cache entfernt.
    operator fun set(key: K, value: V?): Boolean
}
```

Dieses Interface erfasst die **Kernfähigkeiten**: `get` und `set`. Es ist klein, stabil und vorhersehbar. Nichts anderes muss hier enthalten sein, da alles Zusätzliche über Erweiterungen ausgedrückt werden kann.

Als Nächstes denken wir über das **Nutzungserlebnis** nach. In der Praxis möchte man oft **einen Wert lesen oder ihn berechnen und speichern, wenn er nicht vorhanden ist**. Das ist ein sehr häufiges Muster:
```kotlin
val cachedValue = if (cache[key] != null) {
    cache[key]!!
} else {
    val value = computeValue()
    cache[key] = value
    value
}
```
Es jedes Mal zu schreiben, wenn wir mit dem Cache arbeiten, ist ziemlich unpraktisch, nicht wahr? Wir können dieses Muster in einer **einzigen Erweiterung** kapseln und das Kern-Interface unangetastet lassen:
```kotlin
fun <K : Any, V : Any> Cache<K, V>.getOrAssign(key: K, block: () -> V): V {
    return get(key) ?: block().also { set(key, it) }
}
```

Beachten Sie, wie das funktioniert: Das Interface selbst bleibt winzig – nur `get` und `set`. Alles andere lebt in Erweiterungen. Hier ist `getOrAssign` genau diese Art von Erweiterung: Sie ändert nicht, wie der Cache funktioniert, sondern fügt lediglich eine klare, bequeme Art der Nutzung hinzu.

An der Aufrufseite liest es sich fast wie natürliche Sprache: `cache.getOrAssign(key) { aufwendigeBerechnung() }`. Man weiß sofort, was passiert: Wenn der Wert da ist, verwende ihn; andernfalls berechne ihn und speichere ihn. Der Name `getOrAssign` ist bewusst gewählt – wir möchten explizit ausdrücken, was diese Erweiterung tut, und niemanden raten lassen.

Das Schöne an diesem Ansatz ist, dass wir den Kern stabil halten können, während wir Verhalten auf eine Weise hinzufügen, die vorhersehbar und kombinierbar ist. Das hält die Dinge klein, klar und lässt die Funktionalität natürlich wachsen.

Später könnten Sie so etwas wie `invalidate(key: K)` als Erweiterung hinzufügen – alles ohne das ursprüngliche Interface zu berühren. Es lässt die API sauberer wirken als die Abhängigkeit von `set(key, null)` – was zwar funktioniert, sich aber etwas technisch anfühlt und für jemanden, der den Cache nutzt, nicht sofort offensichtlich ist.

## Fazit
Wir verwenden Erweiterungsfunktionen aus vielen Gründen: um technische Einschränkungen zu umgehen (zum Beispiel, wenn eine Klasse nicht zur Änderung verfügbar ist oder wenn bestimmte Funktionen wie `inline`-Funktionen nicht direkt verwendet werden können) und um Code so zu strukturieren, dass das Verständnis verbessert wird.

Erweiterungen sind kein Allheilmittel und sollten nicht mechanisch angewendet werden. Overengineering ist leicht, aber diesen Ansatz ganz zu ignorieren, führt oft zu aufgeblähten Abstraktionen und schlechter Auffindbarkeit.

Gezielt eingesetzt hilft erweiterungsorientiertes Design dabei, Kernabstraktionen klein zu halten, während das Verhalten kontrolliert und lesbar wachsen kann.

Abschließend empfehle ich auch den [Artikel von Roman Elizarov](https://elizarov.medium.com/extension-oriented-design-13f4f27deaee) zum gleichen Thema.

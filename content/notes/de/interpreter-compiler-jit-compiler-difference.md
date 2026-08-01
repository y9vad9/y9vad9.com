---
title: Compiler, Transpiler, Interpreter und JIT
preview: "Notizen aus der Schulzeit darüber, was Compiler, Transpiler, Interpreter und JIT-Compiler eigentlich tun – und warum die Trennung zwischen kompilierten und interpretierten Sprachen unschärfer ist, als sie wirkt."
parents: ["Programmierung"]
date: 2025-10-09
coverImage: ""
---
**Anmerkung:** Ich habe diese Notiz während der Schulzeit verfasst, weil ich einigen meiner Mitschüler dieses Thema erklären musste. Erwartet also nicht zu viel davon 😄

Ein **Compiler** ist ein Programm, das Quellcode in eine Zwischenrepräsentation (Intermediate Representation, IR) oder direkt in Maschinencode transformiert.

Beispiele für Compiler, die Quellcode in IR transformieren, sind solche für Java oder Kotlin. Sprachen wie C++ werden typischerweise direkt in Maschinencode kompiliert.

### Transpiler
Ein **Transpiler** transformiert ebenfalls Quellcode, aber anstatt IR oder Maschinencode zu erzeugen, konvertiert er Code von einer Hochsprache in eine andere. Er transformiert Quellcode in Quellcode einer anderen Sprache, verlässt sich auf die Infrastruktur der anderen Sprache und bietet keine Garantien, zum Beispiel für die Erhaltung der Semantik zwischen den Sprachen.

Vereinfacht ausgedrückt ist es ein "dummer" Prozess wie die Konvertierung von:

```kotlin
fun main() {
    val a: Int = 0
}
```
zu:

```javascript
function main() {
    const a = 0
}
```
Allerdings hat JS keine "main"-Funktionssemantik.

Ein echtes Beispiel dafür kann Babel sein, das JS eines Standards in einen anderen konvertiert. Es "adaptiert" lediglich deine Code-Syntax, ohne ihn auf Fehler zu prüfen.

### Interpreter
Ein **Interpreter** ist ein Programm, das Quellcode oder eine Zwischenrepräsentation (IR) zur Laufzeit on-the-fly in Maschinenbefehle übersetzt, anstatt die Übersetzung zur Kompilierzeit durchzuführen.

Beispiele für Sprachen, die auf diese Weise funktionieren, sind Python und Java.

Aber warum Java? Obwohl Java normalerweise nicht als interpretierte Sprache betrachtet wird, interpretiert die JVM JVM-Bytecode beim ersten Ausführen on-the-fly – und manchmal auch bei nachfolgenden Ausführungen.

Der Unterschied zwischen diesen beiden ist, dass wir zum Deployen von Python den Quellcode direkt senden, während Java-Code vor dem Deployment in Bytecode kompiliert wird.

**Zusammenfassung**

*   Bei Java deployen wir JVM "IR" (besser bekannt als JVM-Bytecode).
*   Bei Python deployen wir den Quellcode, der dann vom Interpreter ausgeführt wird.
*   In beiden Fällen führen jedoch beim ersten Start die JVM und der Python-Interpreter das Programm aus, sodass sich die Prozesse nicht grundlegend unterscheiden.

Sowohl Java als auch Python können JIT-Kompilierung (zum Beispiel via GraalVM) zusätzlich zu ihrer Standardausführung verwenden. Java wird vor dem Deployment kompiliert, während Python beim ersten Ausführen kompiliert wird (Einführung in Python-Bytecode).

Es gibt jedoch wichtige Unterschiede: Python-Bytecode ist nicht über Versionen hinweg stabil und soll es auch nicht sein. Sein Hauptzweck ist es, die Interpretation zu erleichtern, indem Ausdrücke, Klassen und Funktionen vereinfacht werden.

### JIT-Compiler
Ein **JIT-Compiler** (Just-In-Time) ist ein Programm, das neben dem Interpreter arbeitet und die Ausführung analysiert, um die Leistung zu optimieren. Leute verwechseln ihn manchmal mit einem vollständigen Compiler; obwohl er eine Kompilierung durchführt, bedeutet dies nicht, dass das gesamte Programm vollständig kompiliert wird. Zum Beispiel analysiert der JVM-JIT die "Hot Paths" des Programms – Teile des Programms, die häufig ausgeführt werden – und kann verschiedene Optimierungen anwenden, wie zum Beispiel:

*   **Dead Code Elimination**: Code, der nicht verwendet wird, wird zur Laufzeit entfernt.
*   **Method Inlining**: Methoden, die häufig verwendet werden, klein sind und keine Locks einführen (zum Beispiel durch Verwendung des `synchronized`-Schlüsselworts), werden direkt an ihrer Aufrufstelle eingefügt, um die Anzahl der Anweisungen (für einen virtuellen Aufruf) an den Prozessor zu reduzieren.
*   **Branch Elimination**: Eine spekulative Optimierung basierend auf Laufzeit-Ausführungsdaten. Sobald der Interpreter oder die Runtime genügend Informationen über Verzweigungswahrscheinlichkeiten hat (zum Beispiel, wenn ein Zweig selten oder nie ausgeführt wird), kann er den Zweig entfernen und annehmen, dass er nicht auftreten wird. Dies ist nützlich, wenn bestimmte Programmzustände zur Kompilierzeit nicht bestimmt werden können. Typischerweise fügt der JIT "Guards" für eliminierte Zweige ein, die es ihm ermöglichen, auf Interpretation zurückzufallen (und möglicherweise in Maschinencode neu zu kompilieren), falls sich die Annahme als falsch erweist.
*   **Kompilierung in Maschinencode**: Sobald der JIT sieht, dass ein bestimmter Code häufig genug ausgeführt wird, kompiliert er ihn in Binärcode. Einiger Code wird möglicherweise nie kompiliert, zum Beispiel Code, der ausschließlich für das Bootstrapping verwendet wird.

### Was ist der Unterschied zwischen kompilierten und interpretierten Sprachen?
Während C, C++, Rust und ähnliche Sprachen eindeutig kompilierte Sprachen sind (direkt in Maschinencode übersetzt), ist die Unterscheidung bei Java und Python weniger klar.

Obwohl Python als interpretierte Sprache gilt und Java normalerweise nicht, führt die JVM im Wesentlichen die gleiche Art von Ausführung durch wie der Python-Interpreter. Daher liegt der Hauptunterschied im Deployment: Java wird vor dem Deployment kompiliert und benötigt keinen Quellcode zur Ausführung, während Python typischerweise aus dem Quellcode ausgeführt wird.

Letztendlich können wir kompilierte Sprachen als solche betrachten, die vor der Auslieferung in eine ausführbare Form kompiliert werden. Es ist auch erwähnenswert, dass die meisten interpretierten Sprachen ähnlich wie Python funktionieren und sich auf Laufzeit-Interpretation verlassen.

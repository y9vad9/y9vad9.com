---
title: Compiler, Transpiler, Interpreter and JIT
preview: "Ever wondered what actually happens to your code after you hit 'run'? We break down the fundamental differences between compilers, transpilers, and interpreters, and how modern JIT technology blurs the lines."
parents: ["Programming"]
date: 2025-10-09
---
> **Note**: I wrote this note during school motivated by need to explain this topic to some of my peers. Don't expect much from it 😄

A compiler is a program that transforms source code into an intermediate representation (IR) or directly into machine code.

Examples of compilers that transform source code into IR include those targeting Java or Kotlin. Languages like C++ are typically compiled directly into machine code.

## Transpiler
A transpiler also transforms source code, but instead of producing IR or machine code, it converts code from one high-level language to another. It transforms source code into source code of another language, relies on another language's infrastructure and provides no guarantees, for example, for preserving semantics between the languages.

To put it simpler, it's a dummy process like converting:

```kotlin
fun main() {
    val a: Int = 0
}
```
to:

```javascript
function main() {
    const a = 0
}
```
However, JS does not have "main" function semantics.

A real example of it can be a Babel that converts JS of one standard into another. It just "adapts" your code syntax, not checking it for any mistakes or errors.

## Interpreter
An interpreter is a program that translates source code or an intermediate representation (IR) into machine instructions on-the-fly at runtime, rather than performing the translation at compile time.

Examples of languages that work this way include Python and Java.

But why Java? Although Java is usually not considered an interpreted language, the JVM interprets JVM bytecode on-the-fly during the first run — and sometimes on subsequent runs as well.

The difference between these two is that, to deploy Python, we send the source code directly, whereas Java code is compiled beforehand into bytecode before deployment.

## Summary

With Java, we deploy JVM "IR" (more commonly known as JVM bytecode).
With Python, we deploy the source code, which is then executed by the interpreter.
However, in both cases, on the first run, the JVM, and Python interpreter execute the program, so the processes are not fundamentally different.

Both Java and Python can use JIT compilation (for example, via GraalVM) in addition to their standard execution. Java is compiled before deployment, whereas Python is compiled on the first run (Introduction to Python Bytecode).

There are important differences, though: Python bytecode is not stable across versions and is not intended to be. Its primary purpose is to make interpretation easier, by simplifying expressions, classes, and functions.

## JIT-Compiler
A JIT compiler is a program that works alongside the Interpreter, analyzing execution to optimize performance. People sometimes mistake it for a full compiler; while it does perform compilation, this does not mean the entire program is fully compiled. For example, the JVM JIT analyzes the program's hot paths — parts of the program that run frequently — and may apply various optimizations, such as:

- **Dead code elimination**: Code that is not used is removed in runtime.
- **Methods inlining**: Methods that are frequently used, small in size and do not introduce locks (for example, using `synchronized` keyword) are directly inserted in their call site to reduce amount of instructions (for a virtual call) to the processor.
- **Branch elimination**: A speculative optimization based on runtime execution data. Once the interpreter or runtime has enough information about branch probabilities (for example, if a branch is rarely or never executed), it may remove the branch and **assume it will not occur**. This is useful when certain program states cannot be determined at compile time. Typically, the JIT inserts **guards** for eliminated branches, allowing it to **fall back to interpretation** (and potentially recompile into machine code) if the assumption proves incorrect.
- **Compilation into machine code**: Once JIT sees that some code is run frequently enough, it compiles it into a binary code. Some code might never be compiled, for example, code that is used solely for bootstrapping.

## What's the difference between compiled and interpreted languages?
While C, C++, Rust, and similar languages are clearly compiled languages (directly translated into machine code), the distinction is less clear for Java and Python.

Although Python is considered an interpreted language, and Java usually is not, the JVM essentially performs the same kind of execution as the Python interpreter. Therefore, the main difference lies in deployment: Java is compiled before deployment and doesn't need a source code to be executed, whereas Python is typically executed from source.

In the end, we can consider compiled languages as those compiled into an executable form before delivery. It is also worth noting that most interpreted languages operate similarly to Python, relying on runtime interpretation.

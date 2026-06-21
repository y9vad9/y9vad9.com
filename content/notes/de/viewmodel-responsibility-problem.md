---
title: ViewModel ist kein Platz für deine Logik
preview: "Machen Ihre ViewModels zu viel? Wir untersuchen die richtigen Grenzen der ViewModel-Verantwortung und warum die Konzentration auf den UI-Zustand der Schlüssel zu einer gesunden und skalierbaren Softwaredesign ist."
parents: ["Android", "Kotlin", "Softwaredesign"]
date: 2023-02-20
coverImage: ""
---
Einer der häufigsten Fehler, den ich in der Android-Entwicklung sehe, sind **überladene ViewModels**.

Ein ViewModel ist – und sollte bleiben – **ein Halter des UI-Zustands, nicht mehr**. Seine Verantwortung besteht darin, den Zustand (State) offenzulegen (exposen) und zu transformieren. Alles, was nichts mit dem Zustand zu tun hat, wie Navigation oder I/O, gehört nicht dorthin.

## Warum keine Navigation?

Betrachte eine App, die ursprünglich nur für Smartphones entwickelt wurde. Die Navigation ist einfach: Du übergibst einen Navigator und legst Screens auf einen Stack. Stell dir nun vor, du passt dieselbe App für Tablets oder Desktops an.

Plötzlich ist die Navigation kein linearer Stack mehr. Ein Screen muss möglicherweise neben einem anderen erscheinen, in einem Pane oder in einem völlig anderen Layout. Wenn die Navigationslogik im ViewModel lebt, musst du diese Logik pro Formfaktor umschreiben oder verzweigen.

Selbst wenn wir das Single Responsibility Principle ignorieren, koppelt das Einbetten der Navigation in ViewModels diese eng an eine bestimmte UI-Struktur – und das skaliert nicht über eine einzelne Bildschirmgröße hinaus.

## Warum keine I/O-Operationen?

Ein ViewModel, das Low-Level-I/O durchführt, ist ein direkter Schlag gegen Testbarkeit und Wartbarkeit. Diese Belange gehören in den Data-Layer.

Sobald sich I/O in ein ViewModel einschleicht, beginnen Tests, Verantwortlichkeiten zu verwischen.

UI-Logik, Geschäftslogik und Datenzugriff werden zusammen getestet – oder gar nicht. Hier neigen [`@VisibleForTesting`](https://developer.android.com/reference/androidx/annotation/VisibleForTesting), Reflection-Hacks oder einfach fehlende Tests dazu, aufzutauchen.

An diesem Punkt ist das ViewModel kein vorhersehbarer State-Container mehr, sondern ein impliziter Orchestrierer von allem – unantastbar, wie die Hauptfigur in einem Film.

### Die Faustregel
- **UI**: behandelt Navigation und reagiert auf Benutzerinteraktionen
- **ViewModel**: hält und transformiert den Zustand
- **Data / Application / Domain Layers**: behandeln I/O und Geschäftsregeln

Das ist alles. Halte ViewModels langweilig – und deine Architektur bleibt flexibel.

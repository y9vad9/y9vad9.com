---
title: Paketbenennung, um die sich niemand kümmert (aber sollte)
preview: "Warum übersehen Entwickler oft die Paketbenennung? Entdecken Sie ihre entscheidende Rolle bei der Wartbarkeit des Codes und wie das Denken über bloße Ordner hinaus zu klareren Verantwortlichkeiten, einfacherer Navigation und einer robusteren Softwaredesign führen kann."
date: 2025-10-15
coverImage: "attachments/package-naming-problem-cover.webp"
parents: ["Kotlin", "Softwaredesign"]
---
Die Benennung und Organisation von Paketen sind grundlegende Aspekte beim Schreiben wartbarer Codes. Wie wir Dateien und Module gruppieren, beeinflusst nicht nur die Lesbarkeit, sondern auch die Navigationsfreundlichkeit und die zukünftige Entwicklung.

In diesem Artikel werden wir kurz untersuchen, wie Pakete verwendet werden, versuchen, einige Regeln zu erstellen und einige Gründe zu nennen, wann es eine schlechte Idee ist, ein separates Paket zu erstellen und wann nicht.

> Der Artikel wurde ursprünglich auf dev.to veröffentlicht — https://dev.to/y9vad9/package-naming-nobody-cares-about-but-should-3i5

## Was ist ein Paket, wirklich?

Ein Paket ist eines der ersten Konzepte, auf das Sie direkt nach dem Schreiben Ihres grundlegenden "Hello World"-Programms in Java oder Kotlin stoßen. Die einfachste und doch irreführende Beschreibung ist einfach als Ordnerstruktur, die zur Organisation von Code und zur Vermeidung von Namenskonflikten verwendet wird.

Und obwohl dies teilweise stimmt, könnte es Ihnen die falsche Perspektive geben, wann es tatsächlich verwendet werden sollte. Aber halten wir uns an eine Art Definition:

> **Paketname** in Kotlin und Java ist ein **Namespace**, der verwendet wird, um eine Reihe verwandter Typen (Klassen, Schnittstellen, Enums usw.) zu einer kohärenten Einheit zu organisieren. Er dient einem doppelten Zweck: Er bietet eine logische Struktur für eine Codebasis und verhindert Namenskonflikte in großen Anwendungen oder bei der Integration von Bibliotheken von Drittanbietern.

Unter Berücksichtigung unserer früheren "einfachen" Erklärung ist es wahr, dass Pakete uns helfen, Namenskonflikte zu vermeiden, da es selten ist, dass Klassennamen zu 100 % eindeutig sind.

## Pakete als Ordner

Trotz der Vorteile, die Pakete bieten, gibt es einen erheblichen Nachteil: Aufgrund der Implementierung von Paketen in Java und Kotlin – und der Art und Weise, wie IDEs sie handhaben – dienen sie nicht vollständig als echte Namespaces, obwohl sie dies idealerweise tun sollten. Aus diesem Grund neigen wir dazu, unsere Klassen so zu benennen, dass sie für sich allein aussagekräftig genug sind, ohne auf den Paketnamen angewiesen zu sein. Zum Beispiel:
- `UserAnalyticsReport`
- `OrderRepository`
- `UserFileStorageService`

Obwohl diese Klassen in verschiedenen logischen Paketen platziert werden können, wie:
- `com.example.user.UserAnalyticsReport`
- `com.example.order.OrderRepository`
- `com.example.user.UserFileStorageService`

was theoretisch eine Differenzierung ermöglichen könnte, wenn wir so etwas schreiben könnten wie:
```kotlin
import com.example.user

val report = user::AnalyticsReport(...)
```

Leider (und glücklicherweise) sind wir nicht in C++ (was nicht unbedingt gut oder schlecht ist). Da die meisten Leute auf die Auto-Import- und Auto-Completion-Funktionen von IDEs angewiesen sind, arbeiten sie selten direkt mit Paketen und machen sich daher oft nicht viele Gedanken über die Paketstruktur.

Dieser Ansatz kann zu einer fehlerhaften Denkweise bei der Gestaltung Ihrer eigenen Paketstruktur führen – Sie beginnen, in Bezug auf die Gruppierung von Dateien zu denken, anstatt aussagekräftige Namespaces und Grenzen zu definieren, was zu unklaren Verantwortlichkeiten führt. Das Ergebnis ist oft ein Verzeichnis voller Klassen, die nach Ort statt nach Zweck organisiert sind.

Auch wenn es Ihnen ein gutes Gefühl gibt, dass die Dinge "organisiert" sind, führt es meist zu vielen Problemen. Dies ist das falsche Denkmodell.

## Pakete als Namespaces

Ein besseres Denkmodell ist es, Pakete als **semantische Grenzen** zu betrachten – sie sagen Ihnen, welchen Teil des Systems Sie gerade betrachten und idealerweise, wofür dieser Code verantwortlich ist.

Aber seien wir ehrlich: Die meisten Leute behandeln Pakete als bloße Ordner, oft weil sie von der Anzahl der Dateien innerhalb eines Pakets eingeschüchtert sind. Diese "Schubladen"-Mentalität hält uns davon ab, tiefer darüber nachzudenken, **warum** wir Code so gruppieren, wie wir es tun. Ich selbst habe lange Zeit mit dieser Denkweise gekämpft.

Wenn Sie anfangen, Pakete als echte Namespaces zu behandeln, geschehen mehrere vorteilhafte Dinge:
- **Das Paket selbst wird Teil der Dokumentation** – allein durch den Blick darauf, wo eine Klasse lebt, bekommen Sie ein Gefühl dafür, was sie tut und wofür sie verantwortlich ist.
- **Verwandte Funktionalität bleibt natürlich zusammen**, während nicht verwandter Code getrennt bleibt. Es lässt Sie auch mehr darüber nachdenken, "wofür ist es verantwortlich?" / "Wer ist der Besitzer dieser bestimmten Klasse/Funktion?".

Darüber hinaus verschwinden viele gängige Designprobleme in der Software einfach. Einer der größten Übeltäter in großen Codebasen ist die übermäßige oder falsche Anwendung generischer "Kategorie"-Pakete wie `model`, `dto` oder `entity`.

Betrachten Sie zum Beispiel ein großes Projekt, in dem mehrere Teams an benutzerbezogenen Funktionen arbeiten. Möglicherweise sehen Sie Pakete wie:

```
com.example.user.model.profile
com.example.user.profile.model
com.example.user.utils.profile
com.example.user.profile.utils
com.example.user.dto.profile
com.example.user.profile.dto
```
*(Dies ist in Multi-Modul-Projekten noch eher möglich, besonders wenn mehrere Teams beteiligt sind)!*

Hier ist das Konzept "Profil" über mehrere Pakete und Unterpakete verstreut, oft mit doppelten oder umgekehrten Benennungsreihenfolgen. Manchmal ist "Profil" nicht einmal ein eigenständiges Domänenkonzept, sondern nur ein Teil des Benutzeraggregats – doch es wird als eigenes Paket behandelt, um die Anzahl der Dateien in `user.model` zu reduzieren. Teams erstellen unabsichtlich dieselben logischen Gruppierungen mehrmals neu, weil sie nicht erkennen, dass ein gleichwertiges Paket bereits woanders existiert. Dies führt oft zu einer inkonsistenten Paketbenennung, die auf persönlichen Vorlieben statt auf klaren Konventionen basiert, was die Einarbeitung neuer Teammitglieder erschwert und den Prozess verlangsamt. Nie wieder muss man fragen: "Warum ist es nicht hier, sondern hier?".

Obwohl dieses Beispiel vereinfacht ist, werden Sie diesem Problem in realen Projekten unweigerlich begegnen – insbesondere wenn Sie eine Bibliothek pflegen, bei der die Abwärtskompatibilität über Versionen hinweg entscheidend ist. In solchen Fällen können inkonsistente oder unklare Paketstrukturen langfristige Wartungsprobleme verursachen und das Risiko von Breaking Changes erhöhen.

Diese Situation entwickelt sich schnell zu einem Labyrinth, in dem:
- Sie mehr Zeit damit verbringen, zu erraten, wo etwas leben könnte, anstatt zu verstehen, was es tut.
- Die Terminologie in den Teams inkonsistent wird – einige nennen bestimmte Klassen "Modelle", andere nennen dieselben oder ähnliche Konzepte "Entitäten" oder "DTOs".
- Sie sich in redundanten oder widersprüchlichen Paketen wie `user.utils.profile` vs. `user.profile.utils` verheddern, ohne klare Zuständigkeit oder Verantwortung.

In solchen Fällen werden generische Paketnamen wie `utils`, `model` oder `dto` zu bedeutungslosen Labels. Anstatt Ihnen zu helfen, Code basierend auf seiner Verantwortung zu finden, zwingen sie Sie dazu, sich ausschließlich auf die Terminologie zu verlassen – und da verschiedene Personen oder Teams diese Begriffe oft unterschiedlich verwenden, kann dieses Vokabular sich im Laufe der Zeit ändern oder widersprechen. Dies macht das Verständnis der Codebasis stärker davon abhängig, ein sich ständig änderndes und mehrdeutiges Glossar zu beherrschen, anstatt auf intuitiven architektonischen Grenzen.

Im Gegensatz dazu wird die Codebasis, wenn Pakete **Verantwortung** statt nur Dateikategorien oder vager Gruppierungen darstellen, navigierbarer, leichter verständlich und widerstandsfähiger gegenüber Team- oder Terminologieänderungen.

### Was verdient einen Namespace?
Während es relativ einfach ist, darüber nachzudenken, keine `.model`, `.util`, `.impl` und so weiter zu erstellen, bleibt ein großes Problem unbeantwortet – wie man bestimmt, was einen Namespace verdient und was nicht?

Lassen Sie uns ein Beispiel erstellen:
```
com.example.user
 ├─ User.kt
 ├─ UserId.kt
 ├─ UserFactory.kt
 ├─ settings
 │   ├─ UserSettings.kt
 │   ├─ NotificationPreferences.kt
 │   └─ PrivacyOptions.kt
 ├─ profile
 │   ├─ UserProfile.kt
 │   ├─ ProfilePicture.kt
 │   └─ Bio.kt
 ├─ security
 │   ├─ Password.kt
 │   ├─ SecurityQuestions.kt
 │   └─ TwoFactorAuth.kt
 └─ utils
     ├─ UserValidators.kt
     └─ UserMappers.kt
```

> Der Einfachheit halber werden wir die Schichten in unserer Struktur nicht erwähnen.

Das Zusammenklappen aller Ordner mag die Struktur sauber und minimal erscheinen lassen, aber es entwickelt sich oft zu einer langen, mäandrierenden Kette von Unterpaketen ohne klaren Zweck. Nehmen Sie zum Beispiel `profile` – es mag als kohärente, unabhängige Einheit erscheinen, aber wir sollten innehalten und uns fragen:
- Macht `.profile` ohne ein Benutzerkonzept überhaupt Sinn?
- Macht die tatsächliche Verwendung von Entitäten innerhalb von `.profile` außerhalb des `user`-Pakets Sinn (zum Beispiel, ist es nur in eine andere Klasse eingewickelt und wird von dieser verwaltet)? _(Mapper zählen nicht 😁)_
- Bietet dieses Paket eine sinnvolle Black Box mit eigener API, die von mehr als nur Benutzern verwendet wird? Oder ist es etwas, das nur innerhalb von User Sinn macht – zum Beispiel ein UserProfile, das nie unabhängig existiert, immer aus User ausgepackt wird und ohne dieses nicht zugänglich ist?
- Wenn ich etwas in dieser Klassengruppe ändern muss, werde ich normalerweise auch die anderen ändern?

**Wenn eine der Antworten ja ist** → gehören sie höchstwahrscheinlich zusammen in dasselbe Paket.
**Wenn alle nein sind** → verdient es vielleicht ein eigenes Paket.

#### `.common` / `.core` Pakete
Ein weiterer Grenzfall, den ich erwähnenswert finde, sind die Pakete `.common` / `.core`, die ich persönlich häufig in Codebasen sehe. Obwohl sie auf den ersten Blick praktisch erscheinen, ist ihre zugrunde liegende Bedeutung meist wörtlich "dies ist Zeug, das nirgendwo anders hineinpasst". Dies stellt also kein wirklich **kohärentes Konzept** oder eine **klare Grenze** dar.

Die Frage ist einfach – warum `com.example.common` einführen, wenn es entweder an den sinnvollen Ort lokalisiert oder einfach in `com.example` platziert werden sollte? Es ist ein weiteres Beispiel für die "Schubladen"-Mentalität, die dazu führt, dass im Laufe der Zeit jedes Teammitglied dort unzusammenhängenden Code ohne nachzudenken ablegt. Und bald wird das Paket zu einem Sammelsurium aus allem und nichts zugleich.

Da immer mehr unzusammenhängender Code dort abgelegt wird, wird es zum meistabhängigen Teil des Systems, wodurch überall versteckte Kopplungen entstehen. Das wiederum macht Refactoring gefährlich, da das Verschieben von etwas riskant erscheint, wenn man unsicher ist, wer davon abhängt. Im Laufe der Zeit führt dies zu architektonischer Erosion: Statt klar definierter Grenzen neigt das System dazu, sich um ein aufgeblähtes Gott-Paket in seinem Zentrum zu gruppieren.

#### Zusätzliche Denkweise

Als zusätzliche Denkweise können Sie ein "Aggregat" aus DDD als mentales Modell zur Identifizierung eines kohärenten Konzepts betrachten, das einen eigenen Namespace verdient. Die Idee ist, dass ein Paket etwas darstellen sollte, das für die Außenwelt eine eigene Bedeutung und Nützlichkeit hat.

Value Objects, Domain Entities und Events qualifizieren sich oft nicht für separate Pakete, da sie ausschließlich dazu existieren, das Aggregat zu unterstützen – sie haben außerhalb davon keine unabhängige Bedeutung. Das Aufteilen in eigene Pakete würde das Prinzip verletzen, eine klare API nach außen freizulegen, und würde künstliche Grenzen schaffen, wo nichts isoliert Sinn macht.

Alles innerhalb des Aggregats ist stark gekoppelt, und diese Kopplung ist genau der Grund, warum es zusammen in dasselbe Paket gehört: Sie kommuniziert, dass diese Elemente nur im Kontext des Aggregats Bedeutung haben.

Dieser Ansatz stellt sicher, dass Pakete sinnvolle Organisationseinheiten bleiben, anstatt beliebige Ordner, die die wahre Struktur des Systems verschleiern.

## Namespacing auf Makroebene
Bisher haben wir uns auf Pakete auf Mikroebene konzentriert, etwa innerhalb einer Domäne. Aber was ist mit den **Schichten selbst** – `domain`, `infrastructure`, `presentation`?

Auf dieser Ebene signalisieren Pakete **architektonische Grenzen** und bringen offensichtlich viele Vorteile mit sich. `domain` enthält die Kern-Geschäftslogik, `presentation` befasst sich mit APIs oder der Benutzeroberfläche, und `infrastructure` umschließt technische Details wie Datenbanken oder Messaging. Wichtig ist, dass selbst beispielsweise die Infrastruktur oft **autonome Logik und Typen** enthält, um auf ihre Logik zuzugreifen (idealerweise), was sie zu einer kohärenten Einheit an sich macht. Der Schlüssel ist, dass jede Schicht immer noch sinnvolle Einheiten gruppiert, anstatt als Müllhalde zu fungieren. Richtig gemacht, bieten Namespaces auf Makroebene Entwicklern eine **schnelle mentale Karte** des Systems und machen Abhängigkeiten zu Schichten explizit.

Daher können wir dies als etwas Positives und nicht als bedeutungsloses technisches Etikett betrachten – diese Grenzen sind größtenteils autark.

## Benennung eines Namespace (Paket)
Nachdem wir nun behandelt haben, wann ein Paket erstellt werden soll, sprechen wir darüber, **wie es benannt werden soll**. Ein Paket sollte nach dem **Konzept benannt werden, das es darstellt**, nicht nach der Anzahl der darin enthaltenen Elemente.

Wenn Ihr Code beispielsweise um die Verwaltung eines einzelnen `Order` – seiner Validierung, seines Lebenszyklus und seiner Operationen – herum aufgebaut ist, ist die Benennung des Pakets `orders` irreführend. Der Plural impliziert eine Sammlung, was nicht die Tatsache widerspiegelt, dass es in dem Paket um das **Konzept Order** selbst geht. Die richtige Wahl ist `order`, was kommuniziert, dass dieser Namespace das Domänenkonzept betrifft und nicht eine Liste von Orders.

Benennen Sie Pakete auch nicht `errors`, `events` oder `notifications`, nur weil sie mehrere Elemente dieses Typs enthalten. Die Frage, die Sie stellen müssen, lautet: Welches **Konzept oder welche Verantwortung** erfasst dieses Paket? Benennen Sie es nach diesem Konzept, nicht nach der Anzahl der Instanzen, die es enthält. Dies hält Ihre Paketnamen **präzise, aussagekräftig und auf das mentale Modell Ihres Systems abgestimmt**.

Kann ein Paketname jemals plural sein? Sicher. Aber in der Praxis ist es weitaus seltener, als die Leute annehmen. Meistens repräsentiert das Paket ein einziges Konzept, keine Sammlung, daher verwenden wir standardmäßig Singular.

## Den richtigen Fokus setzen
Es reicht nicht aus, nur sinnvolle Namespaces zu erstellen – der _Fokus_ dieser Namespaces ist genauso wichtig.

Betrachten Sie zwei Strukturen:
```
com.example.domain
 └─ user
     └─ User.kt
```

vs:
```
com.example.user
 └─ domain
     └─ User.kt
```

Beide sehen gültig aus, aber sie kommunizieren sehr unterschiedliche Prioritäten. Die erste (`com.example.domain.user`) stellt die technische Schicht an erste Stelle. Die zweite (`com.example.user.domain`) konzentriert sich auf das Konzept – `user` – wobei die Schicht zweitrangig ist.

Dieser Unterschied wird wichtig, wenn das System wächst. Nicht jedes Konzept oder jede Funktion wird eine `.domain`, eine `.presentation` (zum Beispiel hat die Autorisierung höchstwahrscheinlich keine Geschäftslogik, verdient daher keine `.domain`) oder eine andere von Ihnen erwartete Schicht haben. Das bedeutet, dass die Navigation schnell umständlich wird: Man kann nicht sagen, was eine Funktion _tut_ oder _enthält_, sondern nur, dass sie irgendwo unter einem technischen Label liegen könnte. Das Ergebnis sind ungleichmäßige Hierarchien und Ordner, die mit Schichten überladen wirken, während die eigentlichen Geschäftskonzepte vergraben werden.

Module zeigen das gleiche Muster. Im kleinen Maßstab mögen `:domain:user` und `:domain:task` in Ordnung aussehen. Aber sobald Sie `:application:auth`, `:application:user`, `:application:task` hinzufügen (während `:domain:auth` nicht existiert), wird die Navigation seltsam. Man kann die tatsächliche Fähigkeit einer Funktion oder eines abgegrenzten Kontexts nicht sofort erkennen: Hat `auth` überhaupt eine Domänenlogik, oder ist es nur Anwendungscode? Die Struktur betont zuerst technische Grenzen, während die konzeptuellen Grenzen unklar bleiben.

Ein konzeptzentrierter Ansatz – `com.example.user.domain`, `com.example.order.infrastructure` – vermeidet dieses Problem. Sie beginnen immer mit dem, was dem Unternehmen wichtig ist, und verfeinern es erst dann nach der Schicht.

Hat es eine `domain`- oder `infrastructure`-Schicht? Das spielt keine Rolle – wichtig ist das Konzept selbst, und erst dann, wie es intern implementiert wird. **Dies ist besonders wichtig, da sich die Struktur wahrscheinlich im Laufe der Zeit ändern wird.** Und was tun Sie dann?
## Fazit
Fassen wir die wichtigsten Punkte zusammen, beginnend auf der Mikroebene:
- Zunächst würde ich empfehlen, nicht den Weg "wann kein Paket erstellen" zu gehen, sondern den Weg "wann erstellen", was bedeutet, dass wir standardmäßig kein separates Paket erstellen. Es sei denn, wir haben einen triftigen Grund.
- Es ist gerechtfertigt, ein separates Paket zu haben, wenn wir Isolation wünschen, zum Beispiel, wenn wir über eine Schichtdesign sprechen. Es ist auch gerechtfertigt, wenn das Paket tatsächlich eine unabhängige kohäsive Einheit ist, die eine unabhängige Bedeutung hat.
- Wir erstellen definitiv keine Pakete wie `utils`/`ext(ensions)`/`helpers`/ `impl` und dergleichen.
- Wir erstellen keine Pakete, die sich nicht im allgemeinen Kontext repräsentieren.

Auf Makroebene ist es völlig in Ordnung, Pakete wie `domain` oder `infrastructure` zu haben, die die architektonische Schicht widerspiegeln, in der Sie arbeiten. Legen Sie außerdem Ihre Prioritäten richtig fest – das Konzept steht an erster Stelle, dann die Ebene, auf der Sie operieren.

Verwenden Sie schließlich **standardmäßig Singularnamen**, es sei denn, das Konzept selbst ist inhärent plural, wie `news`.

Hier ist ein Beispiel für die Struktur, nur als Referenz:
```
com.example
 ├─ user
 │   ├─ domain
 │   │   ├─ User.kt
 │   │   ├─ UserId.kt
 │   │   └─ UserName.kt
 │   ├─ application
 │   │   ├─ UserService.kt / SomeUseCase.kt
 │   │   └─ UserRepository.kt
 │   └─ infrastructure
 │       ├─ database
 │       │   └─ UserDataSource.kt
 │       └─ adapter
 │           └─ UserRepositoryImpl.kt
 │       └─ messaging
 │           └─ UserEventsPublisher.kt
 ├─ order
 │   ├─ domain
 │   └─ ...
```

Insgesamt können Sie diese Regeln auf andere Sprachen außerhalb des JVM-Ökosystems anwenden, wie z. B. TypeScript mit seinen Modulsystemen oder alles andere, das Namespacing als Konzept hat.

___________

Mehr als 5 Dateien in einem Verzeichnis sind doch nicht so beängstigend, Leute!

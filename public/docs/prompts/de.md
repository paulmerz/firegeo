## Leistungsstarke Prompts schreiben

Gut konstruierte Prompts führen KI‑Modelle zu verwertbaren Antworten: Sie spiegeln das Informationsverhalten Ihrer Kunden wider und geben genug Kontext für Markenvergleiche. Bleiben Sie nah an realistischen Nutzerfragen, um allzu „long‑tail“ Szenarien zu vermeiden, die KIs kaum beantworten können.

### 1. Von einer glaubwürdigen Nutzerintention ausgehen
* Formulieren Sie die Frage wie in einer Suche oder an einen Assistenten ("Welche Lösung…", "Was sind die besten…").
* Pro Prompt ein Anliegen: ein Prompt = ein klarer Bedarf.
* Nutzen Sie Personas, laufende Kampagnen oder wiederkehrende Supportfragen.

**Beispiele**
* ✅ `Welche Brand‑Monitoring‑Lösung passt zu B2B‑KMU?`
* ✅ `Was sind die besten Alternativen zu Voxum für Online‑Reputationsmonitoring?`
* ❌ `Umfassender Vergleich von KI‑Marketing‑Suiten für europäische CAC40‑SaaS‑Healthcare‑Unternehmen` (zu lang/selten; zu wenig Signal für das Modell).

### 2. Ausreichenden Business‑Kontext liefern
* Nennen Sie Unternehmenstyp, Produkt-/Servicekategorie und ggf. Geografie.
* Ergänzen Sie primären Use Case oder Kriterium (z. B. Budget, Geschwindigkeit, Compliance), um die KI zu steuern.
* Nennen Sie nur wenige Hauptkonkurrenten, wenn Sie deren Abdeckung testen wollen.

**Struktur**: `Welche/r + Produktkategorie + für + Segment oder Use Case + (optional: Schlüsselbedingung)`

### 3. Natürlich und präzise formulieren
* Bevorzugen Sie gängige Begriffe ("Tool", "Plattform", "Agentur") statt internem Jargon.
* Vermeiden Sie Keyword‑Ketten/Abkürzungen – wirkt wie künstliche SEO und erzeugt Rauschen.
* Prüfen Sie, ob der Satz laut gelesen flüssig bleibt.

### 4. Voxum‑Optionen nutzen
* **Scope**: Land/Region, Unternehmensgröße oder Branche angeben.
* **Websuche**: aktivieren, wenn sehr aktuelle Infos nötig sind (Quellen werden angezeigt).
* **Dynamische Prompts**: eigene Prompts mit automatisch vorgeschlagenen kombinieren, um Kernmarkt und relevante Nischen abzudecken.

### 5. Ausgewogenen Prompt‑Satz bauen
* Vier bis sechs Prompts genügen: zwei „generische“ (breiter Vergleich), zwei segmentfokussierte und einer zu einem Differenziator (Preis, Innovation, Integrationen etc.).
* Eine defensive Frage einbauen ("Warum wird [Marke] empfohlen für…?") zur Messung des Share of Voice bei Kernnutzen.
* Prompts regelmäßig aktualisieren: nach Releases, neuen Zielgruppen oder großen Kampagnen.

### 6. Mit der GEO‑Methode segmentieren
Für klare Analysen (pro Report ein Thema) erhält jeder Prompt ein strukturiertes Tag‑Set. Eine Analyse = ein primäres GEO‑Tag.

**A. Marktkontext** – Wo steht der/die Sprechende?
* Geografie: Lokal / Regional / National / International
* Segment: B2B / B2C / B2B2C / Enterprise / SMB
* Demografie: Studierende / Professionals / Führungskräfte / Familie / Konsumierende
* Beispiel‑Tag: `[Market: B2B, International, SMB]`

**B. Themenkategorie** – Worum geht es wirklich?
* Produkt (Features, Nutzung, Performance)
* Service (Support, Lieferung, Onboarding)
* Preis & Wert (Kosten, ROI, Aktionen)
* Reputation (Reviews, Vertrauen, Vergleiche)
* Ethik & Marke (Nachhaltigkeit, Inklusion, sozialer Impact)
* Wettbewerber (direkte/indirekte Nennungen)
* Beispiel‑Tag: `[Topic: Price & Value]`

**C. Use Case / Intention** – Welche Handlung liegt nahe?
* Discovery: "Was macht Ihr Tool?"
* Vergleich: "Warum Sie statt X?"
* Kauf: "Wie bestellen?"
* Support: "Ich kann mich nicht einloggen"
* Verlängerung: "Preis des neuen Plans?"
* Advocacy: "Ich habe Ihr Produkt empfohlen"
* Beispiel‑Tag: `[Use Case: Comparison]`

**D. Sentiment und Ton** – Wie klingt die Person?
* Positiv (Enthusiasmus, Loyalität)
* Neutral (sachlich, neugierig)
* Negativ (Beschwerde, Zweifel, Frust)
* Gemischt (Lob + Kritik)
* Optional: emotionale Färbung (dringend, skeptisch, sarkastisch …)
* Beispiel‑Tag: `[Sentiment: Negative, Skeptical]`

**E. Markenassoziation** – Mit wem wird verglichen?
* Nur Ihre Marke
* Namentlich genannter Wettbewerber
* Generische Kategorie ("KI‑Tools")
* Branchenübergreifende Analogie ("wie Amazon für Logistik")
* Beispiel‑Tag: `[Association: Competitor – Brand X]`

### Empfohlener Workflow fürs Team
1. **Prompts sammeln**: aus Support, Sales‑Calls, Chats, Social.
2. **Mit GEO dimensionieren**: mindestens drei Tags (Market, Topic, Use Case); Sentiment/Association ergänzen, wenn vorhanden.
3. **Clustern**: wiederkehrende Prompts bündeln (z. B. Preis‑Beschwerden, B2B SMB Negativ).
4. **KI‑Analyse fahren**: pro Cluster eine Analyse; Frequenz, Tonalität und Wettbewerbsposition messen.
5. **Verankern**: Tags behalten, um Wahrnehmung über die Zeit zu tracken und Roadmaps (Produkt, Marketing, CX) zu speisen.

### Quick‑Checklist vor dem Start
* Wirkt die Intention natürlich für einen Prospect?
* Fokussiert der Prompt auf einen klaren Bedarf?
* Ist Markt/Segment‑Kontext ausreichend?
* Decken wir generische Anfragen und Differenziatoren ab?
* Ist die Formulierung knapp (ein Satz) und frei von internem Jargon?

Mit diesen Prinzipien erhalten Sie konsistente Antworten, die sich leicht zwischen KI‑Anbietern vergleichen lassen und direkt umsetzbar sind.


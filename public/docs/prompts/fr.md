## Rédiger des prompts qui performent

Des prompts bien construits guident les modèles d’IA vers des réponses exploitables : ils reflètent la façon dont vos clients s’informent, tout en donnant assez de contexte pour comparer les marques. L’objectif est de rester proche des questions que poserait un utilisateur réel afin d’éviter des scénarios trop « long tail » que les IA ne comprennent pas ou peu.

### 1. Partir d’une intention utilisateur crédible
* Reformulez la question comme si elle était tapée dans un moteur de recherche ou posée à un assistant (« Quelle solution… », « Quelles sont les meilleures… »).
* Limitez-vous à une problématique par prompt : un prompt = un besoin précis.
* Inspirez-vous de vos personas, des campagnes en cours ou des questions récurrentes au support.

**Exemples**
* ✅ `Quelle solution de veille de marque convient aux PME B2B ?`
* ✅ `Quelles sont les meilleures alternatives à Voxum pour surveiller la réputation en ligne ?`
* ❌ `Comparaison exhaustive des suites marketing IA pour entreprises SaaS européennes du CAC40 spécialisées dans la santé` (question trop longue et rare : le modèle manquera de matière pour répondre).

### 2. Fournir un contexte business suffisant
* Mentionnez le type d’entreprise, la catégorie de produit/service et, si besoin, la zone géographique.
* Ajoutez l’usage ou le critère prioritaire (ex. budget, rapidité, conformité) pour guider l’IA vers les bons arguments.
* Citez quelques concurrents majeurs uniquement si vous souhaitez tester leur couverture.

**Structure type** : `Quelle/Quel + catégorie de produit + pour + segment ou usage + (optionnel : contrainte clé)`

### 3. Utiliser un ton naturel mais précis
* Préférez des termes courants (« outil », « plateforme », « agence ») plutôt que du jargon interne.
* Évitez d’empiler trop de mots-clés ou d’abréviations : cela ressemble à une requête SEO artificielle et produit des réponses bruitées.
* Vérifiez que la phrase reste fluide lorsqu’on la lit à voix haute.

### 4. Tirer parti des options Voxum
* **Scope** : précisez pays/région, taille d’entreprise ou vertical pour focaliser la recherche.
* **Recherche web** : activez le toggle lorsque vous avez besoin d’informations très récentes (l’interface affiche ensuite les sources citées).
* **Prompts dynamiques** : combinez vos prompts maison avec ceux proposés automatiquement pour couvrir à la fois le cœur de marché et les niches pertinentes.

### 5. Construire un set équilibré
* Quatre à six prompts suffisent pour un panorama solide : deux questions « génériques » (comparatif global), deux focalisées sur un segment clé, et une orientée sur un critère différenciant (prix, innovation, intégrations, etc.).
* Introduisez une question défensive (« Pourquoi [marque] est-elle recommandée pour… ? ») afin de mesurer votre part de voix sur vos bénéfices phare.
* Révisez régulièrement les prompts : actualisez-les après une sortie produit, une nouvelle cible ou une campagne importante.

### 6. Segmenter vos analyses avec la méthode GEO
Pour garder une analyse claire (un sujet par rapport), associez chaque prompt à un jeu d’étiquettes structuré. Une analyse = un tag GEO principal.

**A. Contexte marché** – Où se situe l’orateur ?
* Géographie : Local / Régional / National / International
* Segment : B2B / B2C / B2B2C / Enterprise / SMB
* Angle démographique : Étudiant / Professionnel / Cadre / Famille / Consommateur
* Exemple de tag : `[Market: B2B, International, SMB]`

**B. Catégorie de sujet** – De quoi parle vraiment le prompt ?
* Produit (fonctionnalités, usage, performance)
* Service (support, livraison, onboarding)
* Prix & valeur (coûts, ROI, promotions)
* Réputation (avis, confiance, comparaisons)
* Éthique & marque (durabilité, inclusion, impact social)
* Concurrents (mentions directes ou indirectes)
* Exemple de tag : `[Topic: Prix & Valeur]`

**C. Cas d’usage / intention** – Quelle action est sous-entendue ?
* Découverte : « Que fait votre outil ? »
* Comparaison : « Pourquoi vous choisir plutôt que X ? »
* Achat : « Comment commander ? »
* Support : « Je ne peux pas me connecter »
* Renouvellement : « Quel est le tarif du nouveau plan ? »
* Défense/advocacy : « J’ai recommandé votre produit »
* Exemple de tag : `[Use Case: Comparaison]`

**D. Sentiment et ton** – Comment s’exprime la personne ?
* Positif (enthousiasme, fidélité)
* Neutre (factuel, curieux)
* Négatif (plainte, doute, frustration)
* Mixte (louanges + critiques)
* Optionnel : saveur émotionnelle (urgent, sceptique, sarcastique...)
* Exemple de tag : `[Sentiment: Négatif, Sceptique]`

**E. Association de marque** – Avec qui compare-t-on ?
* Votre marque uniquement
* Concurrent nommé (mention explicite)
* Catégorie générique (« outils IA »)
* Comparaison intersectorielle (« comme Amazon pour la logistique »)
* Exemple de tag : `[Association: Concurrent – Marque X]`

### Workflow recommandé pour les équipes
1. **Collecter les prompts** : extraire les questions des tickets support, des appels commerciaux, des chats ou des réseaux sociaux.
2. **Taguer avec les dimensions GEO** : associez au moins trois tags (Marché, Sujet, Cas d’usage). Ajoutez Sentiment et Association si vous avez l’information.
3. **Segmenter par clusters** : regroupez les prompts récurrents (ex. toutes les plaintes prix B2B SMB Négatif).
4. **Lancer l’analyse IA** : créez une analyse par cluster et mesurez fréquence, tonalité et positionnement concurrentiel.
5. **Capitaliser** : conservez vos tags pour suivre l’évolution des perceptions et nourrir vos roadmaps produit, marketing et CX.

### Checklist express avant de lancer l’analyse
* L’intention paraît-elle naturelle pour un prospect ?
* Le prompt est-il centré sur un seul besoin clair ?
* Le contexte marché/segment est-il suffisant ?
* Ai-je couvert à la fois les requêtes génériques et celles liées à nos différenciateurs ?
* La formulation reste-t-elle courte (une seule phrase) et sans jargon interne ?

En appliquant ces principes, vous obtenez des réponses cohérentes, faciles à comparer entre fournisseurs d’IA, et directement exploitables pour vos actions marketing.

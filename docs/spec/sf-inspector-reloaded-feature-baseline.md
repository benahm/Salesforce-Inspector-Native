# Salesforce Inspector Reloaded - baseline fonctionnelle

Date : 2026-04-08

## Objectif

Lister les fonctionnalites importantes de Salesforce Inspector Reloaded afin de definir le perimetre cible de Salesforce Inspector Native, avec une contrainte forte :

- l'application sera 100% dans Salesforce
- l'experience ne reposera pas sur une extension navigateur
- certaines fonctions devront donc etre adaptees plutot que clonees a l'identique

## Sources de reference

- Site de documentation : https://tprouvot.github.io/Salesforce-Inspector-reloaded/welcome/
- Depot GitHub : https://github.com/tprouvot/Salesforce-Inspector-reloaded
- Exemple de page fonctionnelle complementaire : https://tprouvot.github.io/Salesforce-Inspector-reloaded/api-statistics/

## Ce qu'il faut reproduire en priorite

### 1. Data Explorer / Export de donnees

Valeur :

- lancer des requetes SOQL rapidement
- visualiser les resultats sous forme tabulaire
- exporter les resultats
- accelerer l'inspection des donnees sans passer par Developer Console

Capacites a viser dans l'app native :

- editeur SOQL avec historique
- execution SOQL et SOSL
- affichage tabulaire avec pagination
- ouverture rapide d'un enregistrement
- export CSV
- sauvegarde de requetes favorites

Priorite :

- `P0`

### 2. Data Import / Update / Upsert / Delete

Valeur :

- faire des operations de masse rapidement
- corriger ou charger des donnees sans outil externe

Capacites a viser dans l'app native :

- import CSV
- mapping des colonnes vers les champs Salesforce
- modes `insert`, `update`, `upsert`, `delete`
- prevalidation des donnees avant execution
- rapport de succes / erreur par ligne

Priorite :

- `P0`

### 3. Record Inspector / Show All Data

Valeur :

- voir instantanement tous les champs d'un record
- lire les valeurs techniques et pas seulement le layout UI
- faciliter debug, support et integration

Capacites a viser dans l'app native :

- vue complete d'un record par `Id`
- affichage de tous les champs, y compris lecture seule et systeme
- copie rapide des valeurs et API names
- recherche de champ dans le detail du record

Priorite :

- `P0`

### 4. Metadata Explorer / Object & Field Inspector

Valeur :

- comprendre vite la structure des objets
- inspecter les champs, types, relations, picklists, formules, securite

Capacites a viser dans l'app native :

- fiche objet avec metadonnees principales
- liste des champs avec filtres
- detail champ : type, label, API name, longueur, precision, formule, help text
- navigation entre objets lies

Priorite :

- `P0`

### 5. Navigation rapide / Shortcuts

Valeur :

- ouvrir rapidement les pages Salesforce utiles pour admin et dev
- eviter les clics repetitifs dans Setup

Capacites a viser dans l'app native :

- catalogue de raccourcis vers Setup, objets, champs, flows, profils, permission sets, Apex classes, Lightning pages
- raccourcis contextuels depuis un objet, un record ou un utilisateur
- favoris personalisables

Priorite :

- `P1`

### 6. User Inspector

Valeur :

- comprendre rapidement le contexte d'un utilisateur
- aider au debug de securite et de support

Capacites a viser dans l'app native :

- recherche d'utilisateur
- resume du user record
- acces rapide aux profils, permission sets, role, locale, fuseau, login history si accessible

Priorite :

- `P1`

### 7. REST API Explorer

Valeur :

- tester les API Salesforce sans Postman ni Workbench
- accelerer debug d'integration

Capacites a viser dans l'app native :

- console REST interne
- saisie de methode, endpoint, headers, body
- execution et visualisation brute du JSON
- bibliotheque de requetes exemples

Priorite :

- `P1`

Note native Salesforce :

- cette fonction devra etre encadree proprement car une app Salesforce ne "sniffe" pas naturellement les appels comme une extension navigateur
- il faudra s'appuyer sur des callouts ou des endpoints internes controles

### 8. Event Monitor / Streaming Explorer

Valeur :

- suivre les events Salesforce et certains changements de donnees
- aider a comprendre ce qui circule sur la plateforme

Capacites a viser dans l'app native :

- abonnement a des channels de streaming autorises
- affichage temps reel des messages recus
- support initial des Platform Events et Change Data Capture
- journal des derniers evenements

Priorite :

- `P1`

### 9. Field Creator / Quick Metadata Actions

Valeur :

- gagner du temps sur les operations de configuration frequentes

Capacites a viser dans l'app native :

- assistant de creation de champ
- templates de champs frequents
- creation guidee avec validation minimale
- affichage de l'impact potentiel

Priorite :

- `P2`

Note native Salesforce :

- la creation de metadonnees depuis Salesforce meme est possible mais plus sensible qu'en extension
- a cadrer avec precision selon les API disponibles et les droits admin

### 10. API Statistics / Debug usage

Valeur :

- comprendre les usages et les erreurs API
- aider au diagnostic performance et integration

Capacites a viser dans l'app native :

- tableau de bord d'appels executes via l'application
- stats par endpoint, methode, duree, erreurs
- historique de session

Priorite :

- `P2`

Note native Salesforce :

- il sera difficile de reproduire la capture globale du navigateur
- la V1 doit probablement se limiter aux appels emis par Salesforce Inspector Native lui-meme

## Fonctionnalites secondaires observees

Fonctions interessantes mais non essentielles pour une V1 :

- personnalisation visuelle de l'org, par exemple favicon ou repere visuel
- choix de version d'API
- controle d'acces par profils / permissions
- OAuth / Connected App pour certains usages
- evolution UX de l'export/import

Recommandation :

- traiter le controle d'acces comme une fondation transverse plutot qu'une feature visible

## Adaptation au contexte "100% Salesforce"

Ce qu'il ne faut pas copier tel quel :

- injection d'UI dans toutes les pages Salesforce via extension
- interception globale des appels reseau du navigateur
- dependance a des permissions navigateur

Ce qu'il faut transformer en experience native :

- application Lightning avec onglets specialises
- composants LWC pour les vues d'inspection
- services Apex pour SOQL, metadata proxy, import/export, logs et execution controlee
- permission sets dedies pour ouvrir progressivement les modules

## Proposition de decoupage produit

### MVP admin/dev

- Data Explorer
- Record Inspector
- Metadata Explorer
- Import/Update/Delete de donnees

### V2 productivity

- Shortcuts
- User Inspector
- REST API Explorer
- Streaming Explorer

### V3 advanced admin

- Field Creator
- API Statistics
- aides visuelles d'org et options avancees

## Recommandation produit

Si l'objectif est de refaire "a peu pres les memes fonctionnalites", le meilleur angle n'est pas de cloner l'extension page par page.

Le bon cadrage pour Salesforce Inspector Native est plutot :

- un hub admin/dev unique dans Salesforce
- une premiere version centree sur data + metadata + record inspection
- une architecture extensible pour ajouter ensuite API, events et tooling avance

## Backlog initial recommande

1. Creer un shell d'application Lightning avec navigation par modules.
2. Implementer un moteur SOQL avec table de resultats.
3. Ajouter un inspecteur de record par `Id`.
4. Ajouter un explorateur d'objets et de champs.
5. Ajouter un import CSV avec simulation puis execution.
6. Ajouter les permission sets et gardes d'acces.
7. Ajouter un module de raccourcis Setup.

## Hypotheses

- Le projet cible surtout des admins, devs et profils support.
- La priorite est la productivite dans l'org plutot qu'une parite technique parfaite avec l'extension navigateur.
- Certaines features du projet source devront etre simplifiees en V1 pour rester compatibles avec une app purement Salesforce.

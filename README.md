# Freebox OS Wrapper

Une librairie pour faciliter l'utilisation de l'API de [Freebox OS](https://dev.freebox.fr/sdk/os/) (interface pour les boxs françaises de l'opérateur Free). Facilite l'authentification et l'envoi de requêtes.


## Pourquoi faire ?

L'API de Freebox OS est capable d'exécuter de nombreuses actions sur la box, comme la gestion des téléchargements et des fichiers sur le disque interne, ou la gestion des contacts et des appels sur le téléphone fixe. Cependant, l'authentification et la première connexion (register) sont assez complexes. Cette librairie permet de simplifier ces étapes, pour vous offrir une meilleure expérience de développement.


## Installation

> Une version récente de Node.js est requise. Nous n'offrons pas de support pour les versions non LTS, et pour les navigateurs.

```bash
# Avec npm
npm i freebox-wrapper

# Ou avec pnpm
pnpm i freebox-wrapper
```


## Exemples

### Register

Cette étape ne doit être effectuée qu'une seule fois, et permet d'obtenir un `appToken`. C'est une étape obligatoire pour utiliser l'API de Freebox OS. L'écran d'affichage de la Freebox demandera à l'utilisateur de confirmer l'opération.

```js
var { RegisterFreebox } = require("freebox-wrapper")

RegisterFreebox({
	showLogs: true, // affiche les logs dans la console, true par défaut
	appId: "fbx.example",
	appName: "Mon appli",
	appVersion: "1.0.0",
	deviceName: "Mon ordi"
}).then(console.log)
```

### Authentification

L'étape d'authentification permet d'obtenir un token de session, qui est nécessaire pour effectuer des requêtes à l'API.

> L'authentification est automatiquement effectuée lors de l'envoi d'une requête si le token de session n'est pas encore disponible, l'utilisation de cette méthode n'est pas obligatoire.

```js
var { FreeboxClient } = require("freebox-wrapper")

var client = new FreeboxClient({
	verbose: true, // affiche une sortie plus détaillée dans la console, false par défaut
	appId: "fbx.example",
	appToken: "<obtenu avec RegisterFreebox>",
	apiDomain: "<obtenu avec RegisterFreebox>",
	httpsPort: "<obtenu avec RegisterFreebox>"
})
client.authentificate().then(console.log)
```

### Requête

Une fois authentifié, vous pourrez effectuer des requêtes à l'API de Freebox OS.

```js
var systemInfo = await client.fetch({
	url: "v8/system",
	method: "GET", // Peut être omis si GET (valeur par défaut)
	parseJson: true // Retourne la réponse parsée en JSON, ou une erreur si la réponse n'est pas du JSON. Si false, retourne la réponse donnée par node-fetch.
})
console.log(systemInfo)
```

> Le header `Content-Type` est automatiquement défini à `application/json` s'il n'est pas déjà défini.


## Licence

MIT © [Johan](https://johanstick.fr)
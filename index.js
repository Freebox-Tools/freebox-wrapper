// Libs
const { Agent } = require("https")
const { createHmac } = require("crypto")
const _fetch = require("node-fetch")
const version = require("./package.json")?.version

// Pouvoir initialiser le client
/**
 * Initialise le client Freebox
 * @param {Object} options Options du client
 * @param {Boolean} options.verbose Afficher des logs détaillés dans la console
 * @param {String} options.apiDomain Domaine de l'API de la Freebox, "mafreebox.freebox.fr" par défaut
 * @param {Number} options.httpsPort Port HTTPS de l'API de la Freebox
 * @param {String} options.appId Identifiant de l'application
 * @param {String} options.appToken Token de l'application
 * @param {String} options.apiBaseUrl Base d'URL de l'API de la Freebox, "/api/" par défaut
 * @returns {FreeboxClient} Client Freebox
*/
function FreeboxClient(options = {}){
	// On définit les options
	this.options = {}
	this.options.verbose = options.verbose || false
	this.options.apiDomain = options.apiDomain || "mafreebox.freebox.fr"
	this.options.httpsPort = options.httpsPort || 443
	this.options.appId = options.appId
	this.options.appToken = options.appToken
	this.options.apiBaseUrl = options.apiBaseUrl || "/api/"

	// On vérifie les options
	if(!this.options.appId) throw new Error("appId is missing")
	if(!this.options.appToken) throw new Error("appToken is missing")

	// On définit les fonctions
	this.fetch = fetch.bind(this)
	this.authentificate = authentificate.bind(this)

	// On crée l'agent
	this.httpsAgent = new Agent({
		rejectUnauthorized: false
	})

	// On retourne le client
	if(this.options.verbose) console.info("Freebox client initialized!")
	return this
}

// Pouvoir se register
/**
 * Permet de se register auprès de la Freebox pour obtenir un appToken
 * @param {Object} options Options pour le register
 * @param {Boolean} options.showLogs Afficher des logs dans la console
 * @param {String} options.appId Identifiant de l'application
 * @param {String} options.appName Nom de l'application (sera affiché sur l'écran de la Freebox)
 * @param {String} options.appVersion Version de l'application
 * @param {String} options.deviceName Nom du device (sera affiché sur l'écran de la Freebox)
 * @returns {String|Object} Code d'erreur ou informations de connexion
*/
async function RegisterFreebox(options = { showLogs: true, appId: "fbx.example", appName: "Exemple", appVersion: "1.0.0", deviceName: "NodeJS" }){
	// On crée l'agent
	const agent = new Agent({
		rejectUnauthorized: false
	})

	// On vérifie qu'on peut atteindre le serveur
	var freebox = await _fetch("https://mafreebox.freebox.fr/api/v8/api_version", { agent })
	if(!freebox.ok){
		if(options.showLogs) console.error("Impossible de joindre le serveur de votre Freebox (mafreebox.freebox.fr). Êtes-vous bien connecté au même réseau que votre Freebox ?")
		return "UNREACHABLE"
	}

	// On vérifie qu'on peut se connecter
	try {
		freebox = await freebox.json()
	} catch(err){
		if(options.showLogs) console.error(`Impossible de gérer la réponse de votre Freebox. ${err.message || err}`)
		freebox = "UNPARSABLE"
	}
	if(!freebox?.success && (!freebox.api_base_url || !freebox.box_model)){
		if(options.showLogs) console.error(`Impossible de récupérer les informations de votre Freebox. ${freebox.msg || freebox}`)
		return "CANNOT_GET_INFOS"
	}

	// On demande l'autorisation
	if(options.showLogs) console.info("Un message s'affichera dans quelques instants sur l'écran de votre Freebox Server pour permettre l'autorisation.")
	var register = await _fetch("https://mafreebox.freebox.fr/api/v8/login/authorize", {
		agent,
		method: "POST",
		body: JSON.stringify({
			app_id: options.appId,
			app_name: options.appName,
			app_version: options.appVersion,
			device_name: options.deviceName
		}),
		headers: {
			"Content-Type": "application/json"
		}
	})

	// On parse en JSON
	try {
		register = await register.json()
	} catch(err){
		if(options.showLogs) console.error(`Impossible de gérer la réponse de votre Freebox. ${err.message || err}`)
		register = "UNPARSABLE"
	}
	if(!register?.success){
		if(options.showLogs) console.error(`Impossible de demander l'autorisation à votre Freebox. ${register.msg || register}`)
		return "CANNOT_ASK_AUTHORIZATION"
	}

	// On garde le token
	var appToken = register?.result?.app_token
	if(!appToken){
		if(options.showLogs) console.error("Impossible de récupérer le token de votre Freebox. Êtes-vous bien connecté au même réseau que votre Freebox ?")
		return "CANNOT_GET_TOKEN"
	}

	// On attend que l'utilisateur accepte
	var status = "pending"
	while(status == "pending"){
		// On attend 2 secondes
		await new Promise(resolve => setTimeout(resolve, 2000))

		// On vérifie le status
		var status = await _fetch(`https://mafreebox.freebox.fr/api/v8/login/authorize/${register.result.track_id}`, { agent })
		if(!status.ok){
			if(options.showLogs) console.error("Impossible de vérifier l'autorisation de votre Freebox. Êtes-vous bien connecté au même réseau que votre Freebox ?")
			return "UNREACHABLE"
		}

		// On parse en JSON
		try {
			status = await status.json()
		} catch(err){
			if(options.showLogs) console.error(`Impossible de gérer la réponse de votre Freebox. ${err.message || err}`)
			status = "UNPARSABLE"
		}
		if(!status?.success) return status

		// On vérifie le status
		status = status.result.status
	}

	// On vérifie que l'utilisateur a bien accepté
	if(status != "granted"){
		if(options.showLogs) console.error(`Impossible de se connecter à votre Freebox. L'accès ${status.replace("timeout", "a expiré").replace("denied", "a été refusé par l'utilisateur")}.`)
		return "ACCESS_NOT_GRANTED_BY_USER"
	}

	// On retourne des infos
	if(options.showLogs) console.info("Autorisation accordée avec succès !")
	return { appToken, appId: options.appId, apiDomain: freebox.api_domain, httpsPort: freebox.https_port }
}

// Fonction pour faire une requête
/**
 * Permet de faire une requête à l'API de la Freebox
 * @param {Object} options Options de la requête
 * @param {String} options.url URL de la requête (commence par la version et n'est pas absolu, ex: "v8/system")
 * @param {String} options.method Méthode de la requête (GET par défaut)
 * @param {Object} options.body Corps de la requête (doit être transformé en JSON avec JSON.stringify)
 * @param {Boolean} options.parseJson Parser automatiquement le JSON de la réponse, renvoie une erreur JSON si la réponse n'est pas un JSON
 * @param {Boolean} options.headers Headers de la requête (Content-Type et X-Fbx-App-Auth sont automatiquement ajoutés)
 * @returns {Object} Contenu de la réponse si parseJson est à true, sinon la réponse brute du fetch
*/
async function fetch(_options){
	// Faire une copie des options
	var options = Object.assign({}, _options)

	// Obtenir des éléments à partir des options
	var url = options.url
	var parseJson = options.parseJson
	if(this.options.verbose) console.info("Fetch:", url, options)

	// Si l'URL ne commence pas par http
	if(url && !url.startsWith("http")){
		// On enlève le slash au début de l'URL
		if(url.startsWith("/")) url = url.substring(1)

		// On ajoute le domaine
		url = `https://${this.options.apiDomain}:${this.options.httpsPort}${this.options.apiBaseUrl}${url}`
	}

	// On enlève des options, et on ajoute l'agent
	delete options.url
	delete options.parseJson
	options.agent = this.httpsAgent

	// On ajoute le content type JSON
	if(options.headers == undefined) options.headers = {}
	if(options.headers["Content-Type"] == undefined) options.headers["Content-Type"] = "application/json"

	// On ajoute le token de session
	if(this.sessionToken != null && !options?.headers?.["X-Fbx-App-Auth"]){
		options.headers["X-Fbx-App-Auth"] = this.sessionToken
		if(this.options.verbose) console.info("Added token to request:", this.sessionToken)
	}

	// Faire la requête
	var response = await _fetch(url, options)
	if(this.options.verbose) console.info("Fetched:", response.status, response.statusText)

	// Si la requête a échoué
	if(!response.ok){
		// On parse le json
		var json
		try {
			json = await response.json()
		} catch(err){ json = {} }

		// Si on essayait déjà de s'authentifier
		if(this.options.verbose) console.info("Fetch error:", json?.error_code, json?.msg || json)
		if(url.endsWith("login/session")) return { success: false, msg: json?.msg || json, json }

		// Si l'erreur n'est pas lié à l'authentification
		if(json?.error_code != "auth_required") return { success: false, msg: json?.msg || json, json }

		// On s'authentifie
		if(this.options.verbose) console.info("Re-authentificating...")
		var auth = await this.authentificate()
		if(!auth.success) return auth

		// On refait la requête
		if(this.options.verbose) console.info("Re-fetching...")
		return await this.fetch(_options)
	}

	// Si on doit parser le json
	if(parseJson){
		try {
			response = await response.json()
		} catch(err){
			response = { success: false, msg: err?.message || err }
		}
	}

	// On retourne la réponse
	return response
}

// Fonction pour s'authentifier
/**
 * Permet de s'authentifier auprès de l'API de la Freebox
 * @returns {Object} Informations d'après-connexion
*/
async function authentificate(){
	// Obtenir le challenge
	var challenge = await this.fetch({
		url: "v8/login",
		parseJson: true
	})
	if(this.options.verbose) console.info("Got challenge:", challenge?.result?.challenge || challenge?.msg || challenge)
	if(!challenge.success) return challenge

	// Déterminer le mot de passe
	var password = createHmac("sha1", this.options.appToken).update(challenge.result.challenge).digest("hex")
	if(this.options.verbose) console.info("Password for challenge:", password)

	// On s'authentifie
	var auth = await this.fetch({
		url: "v8/login/session",
		method: "POST",
		body: JSON.stringify({
			app_id: this.options.appId,
			password: password
		}),
		parseJson: true
	})
	if(this.options.verbose) console.info("Authentification:", auth.success, auth?.result?.session_token || auth?.msg || auth)
	if(!auth.success) return auth

	// On définit le token de session
	if(this.options.verbose) console.info("Authentificated successfully!")
	this.sessionToken = auth?.result?.session_token

	// On récupère les infos de la box
	var freebox = await this.fetch({
		url: "v8/api_version",
		parseJson: true
	})
	if(this.options.verbose) console.info("Got freebox infos:", freebox)
	this.freebox = freebox

	// On retourne la réponse
	return auth
}

// On exporte ce qu'il faut
module.exports = { FreeboxClient, RegisterFreebox, version }
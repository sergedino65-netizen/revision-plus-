// À placer dans ton dépôt à l'emplacement : netlify/functions/trials.js
//
// Cette fonction gère le compteur d'essais gratuits côté serveur.
// Elle utilise Netlify Blobs (stockage intégré à Netlify, pas de compte externe nécessaire)
// et vérifie l'identité de l'utilisateur via Netlify Identity, pour qu'un utilisateur
// ne puisse pas modifier le compteur d'un autre compte ni le réinitialiser en vidant son cache.
//
// Dépendance à installer dans ton projet : npm install @netlify/blobs

const { getStore } = require("@netlify/blobs");

const MAX_FREE_TRIALS = 3;

exports.handler = async (event, context) => {
  // Netlify remplit automatiquement context.clientContext.user quand la requête
  // contient le token Netlify Identity de l'utilisateur connecté (voir revision-plus.html).
  const user = context.clientContext && context.clientContext.user;

  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Non authentifié. Connecte-toi pour utiliser cette fonctionnalité." })
    };
  }

  const store = getStore("trials");
  const key = user.sub; // identifiant unique et stable de l'utilisateur

  try {
    if (event.httpMethod === "GET") {
      const data = (await store.get(key, { type: "json" })) || { used: 0 };
      return {
        statusCode: 200,
        body: JSON.stringify({ used: data.used, remaining: Math.max(0, MAX_FREE_TRIALS - data.used) })
      };
    }

    if (event.httpMethod === "POST") {
      const data = (await store.get(key, { type: "json" })) || { used: 0 };
      if (data.used >= MAX_FREE_TRIALS) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Essais gratuits épuisés", used: data.used, remaining: 0 })
        };
      }
      data.used += 1;
      await store.setJSON(key, data);
      return {
        statusCode: 200,
        body: JSON.stringify({ used: data.used, remaining: Math.max(0, MAX_FREE_TRIALS - data.used) })
      };
    }

    return { statusCode: 405, body: "Méthode non autorisée" };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur", details: String(err) }) };
  }
};

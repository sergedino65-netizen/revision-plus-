// À placer dans ton dépôt à l'emplacement : netlify/functions/ask-ai.js
//
// Cette fonction reçoit les questions des utilisateurs depuis le site
// et les transmet à l'IA Google Gemini pour obtenir une réponse pédagogique adaptée.
//
// IMPORTANT (sécurité) : la clé API n'est jamais écrite ici en clair.
// Elle doit être ajoutée dans Netlify sous forme de variable d'environnement
// nommée GEMINI_API_KEY (Project configuration > Environment variables).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Méthode non autorisée" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Clé API Gemini manquante côté serveur (variable GEMINI_API_KEY)." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Requête invalide" }) };
  }

  const { type, level, subject, input } = payload;
  if (!input || !input.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Le champ de saisie est vide" }) };
  }

  const levelLabels = { primaire: "Primaire (CP à CM2)", college: "Collège (6e à 3e)", lycee: "Lycée (Seconde à Terminale)" };
  const levelText = levelLabels[level] || "";
  const subjectText = subject || "";

  let instruction;
  if (type === "exercice") {
    instruction = `Tu es un professeur particulier bienveillant qui aide un élève de niveau ${levelText}, en ${subjectText}. Explique pas à pas comment résoudre l'exercice suivant, sans donner directement la réponse finale sans explication : "${input}"`;
  } else if (type === "quiz") {
    instruction = `Tu es un professeur qui crée des quiz pour un élève de niveau ${levelText}, en ${subjectText}. Crée un petit quiz de 5 questions à choix multiples sur ce sujet : "${input}". Donne les réponses correctes à la fin.`;
  } else {
    instruction = `Tu es un professeur particulier bienveillant qui répond à un élève de niveau ${levelText}, en ${subjectText}. Réponds simplement et clairement à cette question : "${input}"`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Erreur de l'IA", details: errText }) };
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Désolé, je n'ai pas pu générer de réponse.";

    return {
      statusCode: 200,
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur", details: String(err) }) };
  }
};

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { PlanStructure, Project, AppSettings } from "../types";
import { storageService } from "./storageService";
import { logError } from "../utils/logger";

let aiClient: GoogleGenAI | null = null;

export const getAiClient = async (): Promise<GoogleGenAI> => {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY as string;

    if (!key || key === "undefined") {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

const generateContentWithRetry = async (params: any, retries = 3, delayMs = 2000): Promise<GenerateContentResponse> => {
  const ai = await getAiClient();
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 'RESOURCE_EXHAUSTED';
      
      if (isRateLimit) {
        if (i < retries - 1) {
          console.warn(`Rate limit hit. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error("Quota API dépassé (Erreur 429). Veuillez patienter quelques instants avant de réessayer ou vérifier votre forfait Google AI Studio.");
        }
      }
      
      // If it's not a rate limit error, or we've exhausted retries, throw
      logError("Gemini API Error", error, { params });
      throw error;
    }
  }
  logError("Gemini API Error", new Error("Échec de la génération de contenu après plusieurs tentatives."));
  throw new Error("Échec de la génération de contenu après plusieurs tentatives.");
};

const getModel = async (project?: Project) => {
  if (project?.aiModel) return project.aiModel;
  const settings = await storageService.getSettings();
  return settings.aiModel || "gemini-3-flash-preview";
};

const getSystemInstruction = async () => {
  const settings = await storageService.getSettings();
  return settings.systemInstruction || "";
};

const extractJson = (text: string): any => {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
      }
    }
    
    // Last resort: try to find anything that looks like a JSON object/array
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (e3) {
        console.error("Failed to parse braced JSON:", e3);
      }
    }

    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(text.substring(firstBracket, lastBracket + 1));
      } catch (e4) {
        console.error("Failed to parse bracketed JSON:", e4);
      }
    }

    throw new Error("Could not find valid JSON in response");
  }
};

export const generatePlan = async (project: Partial<Project>): Promise<PlanStructure> => {
  if (project.documentType === 'tp' && project.generationMode === 'direct') {
    return {
      introduction: { titre: "Contexte et Objectifs", sections: [] },
      chapitres: [
        { titre: "Développement du Travail Pratique", sections: [] }
      ],
      conclusion_generale: "Synthèse",
      annexes: [],
      bibliographie_indicative: []
    };
  }

  const suggestedChapters = Math.max(3, Math.ceil(project.min_pages! / 15));
  const currentYear = new Date().getFullYear();

  let docTypeStr = "mémoire académique";
  let specificInstructions = "";

  if (project.documentType === 'tp') {
    docTypeStr = "Travail Pratique (TP)";
    specificInstructions = `
  IMPORTANT: Un Travail Pratique (TP) n'a pas de canevas fixe. Sa structure dépend ENTIÈREMENT du sujet proposé et des consignes de l'utilisateur.
  - Adapte la structure au sujet exact (ça peut être une suite de questions/réponses, une analyse de cas, un rapport de laboratoire, un essai, un code commenté, etc.).
  - Ne force pas une structure "Introduction / Développement / Conclusion" si le sujet demande autre chose (comme des exercices ou des parties spécifiques).
  - Respecte scrupuleusement le nombre de pages demandé (${project.min_pages} pages). Ajuste le nombre de sections et sous-sections pour atteindre ce volume sans remplissage inutile.
  - NE METS PAS D'ANNEXES. Les annexes sont interdites pour ce TP. Le tableau "annexes" dans le JSON DOIT être vide [].
  - INCLURE UNE BIBLIOGRAPHIE INDICATIVE si le TP nécessite des recherches ou fait plus de 5 pages. Fais un effort d'inclure la bibliographie selon la taille du travail et des notes que tu as mises.
  - Si l'utilisateur a fourni des consignes particulières, elles priment sur tout le reste.
  
  IMPORTANT POUR LE JSON DU TP:
  - Utilise la clé "chapitres" pour lister les différentes parties, questions ou exercices du TP.
  - L'introduction et la conclusion peuvent être très brèves ou optionnelles (tu peux les nommer "Introduction" ou "Préambule").
  - Laisse "annexes" VIDE: [].
    `;
  } else if (project.documentType === 'article') {
    docTypeStr = "Article scientifique / Article de revue";
    specificInstructions = `
  Le plan doit inclure:
  1. Une "INTRODUCTION" (Contexte, Problématique, Objectifs).
  2. Une section "MÉTHODOLOGIE".
  3. Une section "RÉSULTATS / ANALYSE".
  4. Une section "DISCUSSION".
  5. Une "CONCLUSION".
  6. Des "RÉFÉRENCES".
    `;
  } else if (project.documentType === 'rapport') {
    docTypeStr = "Rapport de stage";
    specificInstructions = `
  Le plan doit inclure:
  1. Une "INTRODUCTION" (Un seul point, sans aucun sous-point. Pas de problématique, pas d'hypothèse, pas d'annonce de plan).
  2. Un chapitre "PRÉSENTATION DE LA STRUCTURE D'ACCUEIL".
  3. Un chapitre "DÉROULEMENT DU STAGE ET ACTIVITÉS RÉALISÉES".
  4. Un chapitre "DIFFICULTÉS RENCONTRÉES ET APPORTS DU STAGE".
  5. Un chapitre "ANALYSE CRITIQUE".
  6. Une "CONCLUSION" (Un seul point, sans aucun sous-point).
  
  IMPORTANT POUR LE RAPPORT DE STAGE:
  - L'introduction DOIT avoir un tableau "sections" VIDE: [].
  - NE METS PAS D'ANNEXES. Les annexes sont interdites pour ce rapport. Le tableau "annexes" dans le JSON DOIT être vide [].
    `;
  } else {
    docTypeStr = "mémoire académique";
    specificInstructions = `
  Le plan doit inclure:
  1. Une "INTRODUCTION GÉNÉRALE" (Première partie du travail) avec impérativement cette structure de sous-points:
     0.1. Objet du sujet
     0.2. Problématique
     0.3. Hypothèses
     0.4. Méthodes et techniques (0.4.1. Méthodes: Historique, Descriptive, Analytique, etc. ; 0.4.2. Techniques: Documentaire, Interview, Enquête, etc.)
     0.5. Cadre théorique
     0.6. Choix et intérêt du sujet (Scientifique, Social et Personnel)
     0.7. Délimitation du sujet (Spatiale et Temporelle - ATTENTION: La délimitation temporelle doit s'étendre jusqu'à une période très récente, idéalement l'année en cours ${currentYear})
     0.8. Division du travail
  2. Au moins ${suggestedChapters} chapitres de corps du texte (Chapitre 1, Chapitre 2, etc.) richement structurés avec de nombreuses sections et sous-sections pour permettre d'atteindre les ${project.min_pages} pages.
     ${project.methodology === 'empirical' ? `IMPORTANT: Puisque la méthodologie est EMPIRIQUE, le dernier chapitre de corps DOIT impérativement s'intituler "PRÉSENTATION, ANALYSE ET INTERPRÉTATION DES RÉSULTATS". Ce chapitre doit traiter de la population d'étude, de l'échantillon, des instruments de collecte (questionnaire/entretien) et de la présentation des résultats sous forme de tableaux. AJOUTE ÉGALEMENT "Questionnaire d'enquête" ou "Guide d'entretien" dans la liste des annexes.` : ''}
  3. Une conclusion générale.
  4. Une bibliographie indicative.
  5. Des annexes pertinentes.
    `;
  }

  const prompt = `Génère un plan détaillé de ${docTypeStr} pour le sujet suivant:
  Sujet: ${project.title}
  Filière: ${project.field}
  Université: ${project.university}
  Pays: ${project.country}
  Niveau: ${project.level}
  Langue: ${project.language || 'Français'}
  Norme bibliographique: ${project.norm}
  Nombre minimum de pages: ${project.min_pages}
  ${project.instructions ? `CONSIGNES PARTICULIÈRES: ${project.instructions}` : ''}
  ${project.referenceText ? `EXEMPLE/MODÈLE À SUIVRE (Analyse attentivement la structure, le plan et le style de ce document pour t'en inspirer fidèlement): ${project.referenceText.substring(0, 5000)}` : ''}

  ${specificInstructions}

  IMPORTANT: TOUT le contenu généré (titres, sous-titres, descriptions) DOIT être rédigé dans la langue suivante : ${project.language || 'Français'}. Adapte la terminologie académique à cette langue.

  Réponds UNIQUEMENT en format JSON structuré selon ce schéma:
  {
    "introduction": {
      "titre": "INTRODUCTION",
      "sections": [
        { "titre": "...", "sous_sections": [] }
      ]
    },
    "chapitres": [
      {
        "titre": "...",
        "sections": [
          { "titre": "...", "sous_sections": ["..."] }
        ]
      }
    ],
    "conclusion_generale": "string",
    "annexes": ["string"],
    "bibliographie_indicative": ["string"]
  }`;

  const response = await generateContentWithRetry({
    model: await getModel(project as Project),
    contents: prompt,
    config: {
      systemInstruction: await getSystemInstruction(),
      responseMimeType: "application/json",
    },
  });

  const defaultPlan: PlanStructure = {
    introduction: { titre: "INTRODUCTION GÉNÉRALE", sections: [] },
    chapitres: [],
    conclusion_generale: "",
    bibliographie_indicative: [],
    annexes: []
  };

  try {
    const parsed = extractJson(response.text || "{}");
    return {
      ...defaultPlan,
      ...parsed,
      introduction: { ...defaultPlan.introduction, ...(parsed.introduction || {}) },
      chapitres: Array.isArray(parsed.chapitres) ? parsed.chapitres : [],
      bibliographie_indicative: Array.isArray(parsed.bibliographie_indicative) ? parsed.bibliographie_indicative : [],
      annexes: Array.isArray(parsed.annexes) ? parsed.annexes : []
    };
  } catch (error) {
    console.error("Failed to parse plan JSON:", error);
    logError("Failed to parse plan JSON", error, { responseText: response.text });
    return defaultPlan;
  }
};

export const generateChapterContent = async (
  project: Project,
  plan: PlanStructure,
  chapterTitle: string,
  previousContext: string = "",
  targetWords: number = 2000
): Promise<string> => {
  const isResultsChapter = chapterTitle.toUpperCase().includes("PRÉSENTATION") && chapterTitle.toUpperCase().includes("RÉSULTATS");
  const isIntroduction = chapterTitle.toUpperCase().includes("INTRODUCTION");
  const isConclusion = chapterTitle.toUpperCase().includes("CONCLUSION");
  const isBibliography = chapterTitle.toUpperCase().includes("BIBLIOGRAPHIE");
  const isAnnexes = chapterTitle.toUpperCase().includes("ANNEXE");
  
  const shouldHaveFootnotes = project.documentType !== 'rapport' && !isConclusion && !isBibliography && !isAnnexes;
  const currentYear = new Date().getFullYear();

  let docTypeStr = "mémoire académique";
  let specificInstructions = "";

  if (project.documentType === 'tp') {
    docTypeStr = "Travail Pratique (TP)";
    specificInstructions = `
  CONSIGNES SPÉCIFIQUES POUR UN TP :
  - Un TP n'a pas de forme fixe, adapte-toi strictement au sujet et aux consignes de l'utilisateur.
  - Le contenu doit être direct, pertinent et répondre exactement à ce qui est demandé.
  - Fais un effort particulier pour respecter le volume attendu (environ ${targetWords} mots pour cette partie) afin d'atteindre le nombre de pages global demandé par l'utilisateur.
  - Ne pas utiliser un style trop pompeux comme pour une thèse, reste pratique et concret.
  - Aucune annexe ne doit être générée ou mentionnée.
  ${project.generationMode === 'direct' ? "- MODE DIRECT: Réponds simplement et directement aux consignes ou au prompt donné, sans chercher à structurer de manière académique complexe." : ""}
    `;
  } else if (project.documentType === 'article') {
    docTypeStr = "Article scientifique / de revue";
  } else if (project.documentType === 'rapport') {
    docTypeStr = "Rapport de stage";
    specificInstructions = `
  CONSIGNES SPÉCIFIQUES POUR UN RAPPORT DE STAGE :
  - NE PAS inclure de bibliographie.
  - NE PAS inclure de notes de bas de page.
  - Le style doit être professionnel, descriptif et analytique, ancré dans la réalité de l'entreprise.
  - L'introduction doit être courte (1 à 2 pages maximum, soit environ 300 à 600 mots). Elle ne doit PAS contenir de sous-points, de problématique, d'hypothèse ou d'annonce de plan.
  - La conclusion doit être courte (1 à 2 pages maximum).
  - Aucune annexe ne doit être générée.
    `;
  }

  const prompt = `Tu es un expert académique. Rédige le contenu complet de la section suivante pour un ${docTypeStr} de niveau ${project.level}.
  
  CONTEXTE DU PROJET:
  Sujet: ${project.title}
  Filière: ${project.field}
  Norme: ${project.norm}
  Langue: ${project.language || 'Français'}
  Méthodologie: ${project.methodology === 'empirical' ? 'EMPIRIQUE (Enquête de terrain)' : 'CLASSIQUE (Théorique)'}
  Plan complet: ${JSON.stringify(plan)}
  
  SECTION À RÉDIGER: ${chapterTitle}
  
  CONTEXTE PRÉCÉDENT (Résumé des sections déjà rédigées):
  ${previousContext}
  
  CONSIGNES GÉNÉRALES:
  - Style académique soutenu, rigoureux et professionnel.
  - Développe en profondeur chaque sous-section mentionnée dans le plan pour cette partie.
  - S'il s'agit de l'INTRODUCTION, respecte scrupuleusement la numérotation des sous-points demandée dans le plan.
  - Inclus des débats doctrinaux, des théories comparées et des analyses critiques.
  - Adapte le contenu au contexte local (${project.country}) si pertinent.
  - IMPORTANT (DATES ET RÉFÉRENCES) : Les délimitations temporelles du sujet doivent s'étendre jusqu'à une période très récente (idéalement jusqu'à l'année en cours, ${currentYear}). De même, si tu cites des sites web dans les notes de bas de page ou la bibliographie, la "date de consultation" doit être de l'année en cours (${currentYear}).
  - Utilise des citations réelles ou réalistes respectant la norme ${project.norm}.
  ${shouldHaveFootnotes ? `- IMPORTANT (NOTES DE BAS DE PAGE ET RÉFÉRENCES) : 
    1. Tu DOIS générer un TRÈS GRAND NOMBRE de notes de bas de page (au moins 10 à 15 par chapitre). C'est une exigence académique stricte.
    2. Insère une note de bas de page à CHAQUE FOIS que tu cites un auteur, un chiffre, une donnée sensible, une statistique, une définition technique, une théorie importante ou un fait historique.
    3. Utilise STRICTEMENT la norme bibliographique sélectionnée : ${project.norm}.
    4. La numérotation des notes doit être séquentielle, claire et commencer à 1 pour chaque chapitre. Utilise la syntaxe Markdown standard : place [^1], [^2], etc. EXACTEMENT à l'endroit de la citation dans le texte, juste après le mot ou la phrase concernée.
       Exemple dans le texte : "Selon Bourdieu, la reproduction sociale est un mécanisme clé [^1]."
    5. Définis TOUTES les notes de bas de page à la toute fin du texte généré, en utilisant le format : 
       [^1]: Nom de l'auteur, Titre de l'ouvrage, Éditeur, Année, Page. (formaté selon la norme ${project.norm})
    6. ASSURE-TOI qu'il n'y a aucune confusion : la note [^X] à la fin du texte doit correspondre EXACTEMENT à l'appel de note [^X] dans le texte, et citer le bon auteur ou la bonne source. Ne mélange pas les références.` : `- INTERDICTION STRICTE DE NOTES DE BAS DE PAGE : Ne génère AUCUNE note de bas de page dans cette section (${chapterTitle}).`}
  ${isIntroduction || isConclusion ? `- INTERDICTION STRICTE DE TABLEAUX : Ne génère AUCUN tableau dans cette section (${isIntroduction ? "l'introduction" : "la conclusion"}). Les tableaux sont strictement réservés au développement du travail.` : `- IMPORTANT (TABLEAUX) : Intègre de VRAIS tableaux Markdown bien formatés (avec les balises | et -) pour présenter des données, des comparaisons ou des statistiques. N'utilise pas d'autres signes ou balises HTML.`}
  - Le contenu doit être extrêmement riche, détaillé et exhaustif.
  - Vise STRICTEMENT environ ${targetWords} mots pour cette section. C'est CRUCIAL pour atteindre l'objectif global de ${project.min_pages} pages pour le document complet. Ne sois ni trop court ni trop long.
  - Développe chaque point avec des exemples, des analyses, des citations et des arguments solides. Ne sois pas superficiel.
  - Assure une transition fluide entre les sous-sections.

  ${specificInstructions}

  ${isResultsChapter && project.methodology === 'empirical' ? `
  CONSIGNES SPÉCIFIQUES POUR LE CHAPITRE DE RÉSULTATS:
  1. Présente d'abord la population d'étude et l'échantillon (donne des chiffres précis, ex: 50 ou 100 personnes).
  2. Décris l'instrument de collecte (Questionnaire d'enquête ou Guide d'entretien).
  3. Présente la technique de dépouillement (Fréquences et pourcentages).
  4. GÉNÈRE ET PRÉSENTE ENTRE 10 ET 15 TABLEAUX STATISTIQUES.
  5. Chaque tableau doit suivre ce format Markdown:
     ### Tableau X : [Titre du tableau]
     | [Critère/Réponse] | Effectif | Pourcentage |
     | :--- | :---: | :---: |
     | ... | ... | ... |
     | **Total** | **X** | **100 %** |
     
     **Commentaire :**
     [Analyse détaillée du tableau mettant en évidence les tendances majeures, les corrélations et l'interprétation académique des résultats en lien avec les hypothèses].
  6. Assure-toi que les données dans les tableaux sont cohérentes entre elles et avec le sujet.
  7. Termine par une interprétation globale des résultats confrontant les données empiriques aux objectifs et hypothèses du travail.
  ` : ''}
  
  Rédige directement le texte du chapitre en Markdown.`;

  const response = await generateContentWithRetry({
    model: await getModel(project),
    contents: prompt,
    config: {
      systemInstruction: await getSystemInstruction(),
    },
  });

  return response.text || "";
};

export const generateFrontMatter = async (project: Project): Promise<any> => {
  const prompt = `Génère les éléments techniques suivants pour le document:
  Sujet: ${project.title}
  Filière: ${project.field}
  Université: ${project.university}
  Langue: ${project.language || 'Français'}
  
  Éléments requis:
  1. Page de garde
  2. Dédicace
  3. Remerciements
  4. Résumé (Français)
  5. Abstract (Anglais)
  6. Liste des sigles
  
  IMPORTANT: Rédige ces éléments dans la langue du document (${project.language || 'Français'}).
  
  Réponds en JSON:
  {
    "page_de_garde": "string",
    "dedicace": "string",
    "remerciements": "string",
    "resume_fr": "string",
    "abstract_en": "string",
    "sigles": ["string"]
  }`;

  const response = await generateContentWithRetry({
    model: await getModel(project),
    contents: prompt,
    config: {
      systemInstruction: await getSystemInstruction(),
      responseMimeType: "application/json",
    },
  });

  const defaultFrontMatter = {
    page_de_garde: "",
    dedicace: "",
    remerciements: "",
    resume_fr: "",
    abstract_en: "",
    sigles: []
  };

  try {
    const parsed = extractJson(response.text || "{}");
    return { ...defaultFrontMatter, ...parsed };
  } catch (error) {
    console.error("Failed to parse front matter JSON:", error);
    return defaultFrontMatter;
  }
};

export const refineContent = async (
  project: Project,
  currentContent: string,
  instruction: string
): Promise<string> => {
  const prompt = `Tu es un expert académique. Tu dois modifier le texte suivant d'un document en suivant les instructions de l'utilisateur.
  
  SUJET DU DOCUMENT: ${project.title}
  FILIÈRE: ${project.field}
  LANGUE: ${project.language || 'Français'}
  
  TEXTE ACTUEL:
  ---
  ${currentContent}
  ---
  
  INSTRUCTION DE MODIFICATION:
  ${instruction}
  
  CONSIGNES:
  - Rédige tes modifications dans la langue du document (${project.language || 'Français'}).
  - Garde un style académique rigoureux.
  - Ne réponds QUE par le nouveau texte complet (pas de commentaires).
  - Respecte le format Markdown.`;

  const response = await generateContentWithRetry({
    model: await getModel(project),
    contents: prompt,
    config: {
      systemInstruction: await getSystemInstruction(),
    },
  });

  return response.text || currentContent;
};

export const refinePlan = async (
  project: Project,
  currentPlan: PlanStructure,
  instruction: string
): Promise<PlanStructure> => {
  const prompt = `Tu es un expert académique. Tu dois modifier le plan de document suivant en suivant les instructions de l'utilisateur.
  
  SUJET DU DOCUMENT: ${project.title}
  FILIÈRE: ${project.field}
  LANGUE: ${project.language || 'Français'}
  
  PLAN ACTUEL:
  ${JSON.stringify(currentPlan, null, 2)}
  
  INSTRUCTION DE MODIFICATION:
  ${instruction}
  
  CONSIGNES:
  - Rédige tes modifications dans la langue du document (${project.language || 'Français'}).
  - Respecte scrupuleusement le format JSON.
  - Garde la structure de l'introduction (0.1 à 0.8) intacte sauf si l'instruction demande spécifiquement de la modifier.
  - Réponds UNIQUEMENT par le nouveau JSON complet.`;

  const response = await generateContentWithRetry({
    model: await getModel(project),
    contents: prompt,
    config: {
      systemInstruction: await getSystemInstruction(),
      responseMimeType: "application/json",
    },
  });

  try {
    const parsed = extractJson(response.text || "{}");
    return parsed;
  } catch (error) {
    console.error("Failed to parse refined plan JSON:", error);
    return currentPlan;
  }
};

export const detectAIContent = async (text: string): Promise<{ aiProbability: number, humanProbability: number }> => {
  const prompt = `En tant qu'expert en détection de contenu généré par l'IA, analyse ce texte. 
Attention : Ne confonds pas un texte académique bien écrit par un humain avec un texte généré par l'IA. Les humains peuvent écrire sans fautes et de manière structurée.

TEXTE À ANALYSER:
---
${text.substring(0, 10000)}
---

Pour déterminer la probabilité d'IA, cherche UNIQUEMENT ces signes révélateurs :
1. Manque de "Burstiness" (toutes les phrases ont presque la même longueur et la même structure rythmique).
2. Manque de "Perplexité" (vocabulaire extrêmement prévisible, plat, sans aspérité ni choix de mots singuliers).
3. Présence de tics de langage IA ("Il est crucial de", "Dans un monde en constante évolution", "En conclusion", "Il convient de noter", "Cependant", "En outre").
4. Symétrie excessive et transitions robotiques entre les paragraphes.

Si le texte semble naturel, même s'il est très bien écrit, donne une forte probabilité humaine (ex: 80-95%).
Ne donne une forte probabilité IA (>70%) que si les tics de langage IA sont flagrants et la structure est robotique.

Réponds UNIQUEMENT avec un objet JSON contenant deux propriétés : "aiProbability" (un nombre entre 0 et 100) et "humanProbability" (un nombre entre 0 et 100). La somme doit faire 100.`;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for more consistent analysis
      },
    });

    const result = extractJson(response.text || "{}");
    return {
      aiProbability: result.aiProbability || 0,
      humanProbability: result.humanProbability || 100
    };
  } catch (error) {
    console.error("Error detecting AI content:", error);
    return { aiProbability: 0, humanProbability: 100 };
  }
};

export const paraphraseText = async (text: string, language: string = 'fr'): Promise<string> => {
  const prompt = `Tu es un professeur d'université et un rédacteur académique expert. Ta tâche est de réécrire le texte suivant pour qu'il soit indétectable par les détecteurs d'IA (Turnitin, Compilatio) TOUT EN CONSERVANT RIGOUREUSEMENT le sens exact, la nuance, le contexte et le niveau académique du texte d'origine.

TEXTE ORIGINAL:
---
${text}
---

CONSIGNES STRICTES DE REFORMULATION:
1. PRIORITÉ ABSOLUE : Préserve le sens exact, les concepts clés, et la logique du texte d'origine. Ne perds aucune information et ne déforme pas le contexte.
2. Ton académique et fluide : Garde un style professionnel, universitaire et cohérent. Les phrases ne doivent pas être artificiellement courtes ou hachées. L'enchaînement des idées doit être parfait.
3. Humanisation naturelle : Pour éviter la détection IA, utilise un vocabulaire riche, précis et varié. Reformule les phrases de manière élégante sans utiliser de structures robotiques, mais garde des phrases de longueur normale pour un mémoire.
4. Élimine les tics de l'IA : N'utilise JAMAIS d'expressions stéréotypées comme "Il est important de noter que", "En conclusion", "Dans le paysage actuel", "Il convient de souligner", "Cependant", "En outre", "Crucial".
5. La langue de sortie doit être: ${language === 'en' ? 'Anglais' : 'Français'}.
6. Ne réponds QUE par le texte paraphrasé, sans aucun commentaire.`;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-3.1-pro-preview", // Use Pro for better paraphrasing quality
      contents: prompt,
      config: {
        temperature: 0.3, // Lower temperature to maintain strict academic meaning and context
      }
    });

    return response.text || text;
  } catch (error: any) {
    console.error("Error paraphrasing text:", error);
    throw new Error(error.message || "Échec de la paraphrase du texte");
  }
};

export const verifySource = async (sourceText: string, projectContext?: string): Promise<{ isReliable: boolean; score: number; explanation: string; provenance: string; relevance: string; type: string }> => {
  const contextPrompt = projectContext ? `\nCONTEXTE DU TRAVAIL:\n${projectContext}\n` : '';
  const prompt = `En tant qu'expert en recherche académique et bibliothécaire universitaire, évalue la fiabilité, la crédibilité, la provenance et la pertinence de la source suivante.

SOURCE À ANALYSER:
---
${sourceText}
---
${contextPrompt}
INSTRUCTIONS:
Analyse cette source selon les critères académiques (auteur, éditeur, date, type de publication, objectivité, comité de lecture).
Renvoie UNIQUEMENT un objet JSON valide avec la structure suivante, sans aucun autre texte :
{
  "isReliable": boolean (true si la source est académiquement acceptable, false sinon),
  "score": number (de 0 à 100, représentant le degré de fiabilité),
  "explanation": string (une explication courte et précise justifiant l'évaluation),
  "provenance": string (une explication détaillée de la provenance de la note/source, d'où elle vient, qui l'a publiée),
  "relevance": string (le lien entre cette source et le contexte du travail, comment elle s'y rapporte, ou "Non applicable" si pas de contexte fourni),
  "type": string (le type de source détecté : "Article scientifique", "Livre", "Site web institutionnel", "Blog", "Article de presse", "Inconnu", etc.)
}`;

  try {
    const response = await generateContentWithRetry({
      model: await getModel(),
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });
    
    const text = response.text || "{}";
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error verifying source:", error);
    return { isReliable: false, score: 0, explanation: "Erreur lors de l'analyse de la source.", provenance: "Inconnue", relevance: "Inconnue", type: "Inconnu" };
  }
};

export const generateCitation = async (
  data: { author?: string; title?: string; year?: string; publisher?: string; url?: string; type?: string },
  format: 'APA' | 'MLA' | 'Chicago' | 'Harvard'
): Promise<string> => {
  const prompt = `Génère une citation bibliographique parfaitement formatée selon la norme ${format}.
  
DONNÉES DE LA SOURCE:
${JSON.stringify(data, null, 2)}

INSTRUCTIONS:
1. Formate la citation exactement selon les règles de la norme ${format}.
2. Si des informations manquent, fais de ton mieux avec ce qui est fourni (ex: "s.d." pour sans date).
3. Ne renvoie QUE la citation formatée, sans aucun autre texte, commentaire ou guillemets.`;

  try {
    const response = await generateContentWithRetry({
      model: await getModel(),
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Error generating citation:", error);
    return "Erreur lors de la génération de la citation.";
  }
};

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { PlanStructure, Project } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generatePlan = async (project: Partial<Project>): Promise<PlanStructure> => {
  const prompt = `Génère un plan détaillé de mémoire académique pour le sujet suivant:
  Sujet: ${project.title}
  Filière: ${project.field}
  Université: ${project.university}
  Pays: ${project.country}
  Niveau: ${project.level}
  Norme bibliographique: ${project.norm}
  Nombre minimum de pages: ${project.min_pages}
  ${project.instructions ? `CONSIGNES PARTICULIÈRES: ${project.instructions}` : ''}
  ${project.referenceText ? `EXEMPLE/MODÈLE À SUIVRE (Analyse attentivement la structure, le plan et le style de ce document pour t'en inspirer fidèlement): ${project.referenceText.substring(0, 50000)}` : ''}

  Le plan doit inclure:
  1. Une "INTRODUCTION GÉNÉRALE" (Première partie du travail) avec impérativement cette structure de sous-points:
     0.1. Objet du sujet
     0.2. Problématique
     0.3. Hypothèses
     0.4. Méthodes et techniques (0.4.1. Méthodes: Historique, Descriptive, Analytique, etc. ; 0.4.2. Techniques: Documentaire, Interview, Enquête, etc.)
     0.5. Cadre théorique
     0.6. Choix et intérêt du sujet (Scientifique, Social et Personnel)
     0.7. Délimitation du sujet (Spatiale et Temporelle)
     0.8. Division du travail
  2. Au moins 3 chapitres de corps du texte (Chapitre 1, Chapitre 2, etc.) richement structurés.
  3. Une conclusion générale.
  4. Une bibliographie indicative.

  Réponds UNIQUEMENT en format JSON structuré selon ce schéma:
  {
    "introduction": {
      "titre": "INTRODUCTION GÉNÉRALE",
      "sections": [
        { "titre": "0.1. Objet du sujet", "sous_sections": [] },
        { "titre": "0.2. Problématique", "sous_sections": [] },
        { "titre": "0.3. Hypothèses", "sous_sections": [] },
        { "titre": "0.4. Méthodes et techniques", "sous_sections": ["0.4.1. Méthodes", "0.4.2. Techniques"] },
        { "titre": "0.5. Cadre théorique", "sous_sections": [] },
        { "titre": "0.6. Choix et intérêt du sujet", "sous_sections": ["Scientifique", "Social", "Personnel"] },
        { "titre": "0.7. Délimitation du sujet", "sous_sections": ["Spatiale", "Temporelle"] },
        { "titre": "0.8. Division du travail", "sous_sections": [] }
      ]
    },
    "chapitres": [
      {
        "titre": "Chapitre 1: ...",
        "sections": [
          { "titre": "...", "sous_sections": ["..."] }
        ]
      }
    ],
    "conclusion_generale": "string",
    "bibliographie_indicative": ["string"]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
};

export const generateChapterContent = async (
  project: Project,
  plan: PlanStructure,
  chapterTitle: string,
  previousContext: string = ""
): Promise<string> => {
  const prompt = `Tu es un expert académique. Rédige le contenu complet du chapitre suivant pour un mémoire de ${project.level}.
  
  CONTEXTE DU PROJET:
  Sujet: ${project.title}
  Filière: ${project.field}
  Norme: ${project.norm}
  Plan complet: ${JSON.stringify(plan)}
  
  CHAPITRE À RÉDIGER: ${chapterTitle}
  
  CONTEXTE PRÉCÉDENT (Résumé des chapitres déjà rédigés):
  ${previousContext}
  
  CONSIGNES:
  - Style académique soutenu, rigoureux et professionnel.
  - Développe en profondeur chaque section et sous-section mentionnée dans le plan pour ce chapitre.
  - S'il s'agit de l'INTRODUCTION GÉNÉRALE, respecte scrupuleusement la numérotation des sous-points (0.1, 0.2, etc.) demandée dans le plan.
  - Inclus des débats doctrinaux, des théories comparées et des analyses critiques.
  - Adapte le contenu au contexte local (${project.country}) si pertinent.
  - Utilise des citations réelles ou réalistes respectant la norme ${project.norm}.
  - IMPORTANT: Utilise des NOTES DE BAS DE PAGE pour citer les auteurs ou apporter des précisions importantes.
  - Format des notes: Utilise la syntaxe Markdown standard [^1] dans le texte et définit la note à la fin du texte avec [^1]: Contenu de la note.
  - Les notes doivent être pertinentes et non excessives.
  - Le contenu doit être très long et détaillé pour atteindre l'objectif de 60 pages au total.
  - Vise environ 3000 à 4000 mots pour ce chapitre.
  
  Rédige directement le texte du chapitre en Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });

  return response.text || "";
};

export const generateFrontMatter = async (project: Project): Promise<any> => {
  const prompt = `Génère les éléments techniques suivants pour le mémoire:
  Sujet: ${project.title}
  Filière: ${project.field}
  Université: ${project.university}
  
  Éléments requis:
  1. Page de garde
  2. Dédicace
  3. Remerciements
  4. Résumé (Français)
  5. Abstract (Anglais)
  6. Liste des sigles
  
  Réponds en JSON:
  {
    "page_de_garde": "string",
    "dedicace": "string",
    "remerciements": "string",
    "resume_fr": "string",
    "abstract_en": "string",
    "sigles": ["string"]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
};

export const refineContent = async (
  project: Project,
  currentContent: string,
  instruction: string
): Promise<string> => {
  const prompt = `Tu es un expert académique. Tu dois modifier le texte suivant d'un mémoire en suivant les instructions de l'utilisateur.
  
  SUJET DU MÉMOIRE: ${project.title}
  FILIÈRE: ${project.field}
  
  TEXTE ACTUEL:
  ---
  ${currentContent}
  ---
  
  INSTRUCTION DE MODIFICATION:
  ${instruction}
  
  CONSIGNES:
  - Garde un style académique rigoureux.
  - Ne réponds QUE par le nouveau texte complet (pas de commentaires).
  - Respecte le format Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });

  return response.text || currentContent;
};

export const refinePlan = async (
  project: Project,
  currentPlan: PlanStructure,
  instruction: string
): Promise<PlanStructure> => {
  const prompt = `Tu es un expert académique. Tu dois modifier le plan de mémoire suivant en suivant les instructions de l'utilisateur.
  
  SUJET DU MÉMOIRE: ${project.title}
  FILIÈRE: ${project.field}
  
  PLAN ACTUEL:
  ${JSON.stringify(currentPlan, null, 2)}
  
  INSTRUCTION DE MODIFICATION:
  ${instruction}
  
  CONSIGNES:
  - Respecte scrupuleusement le format JSON.
  - Garde la structure de l'introduction (0.1 à 0.8) intacte sauf si l'instruction demande spécifiquement de la modifier.
  - Réponds UNIQUEMENT par le nouveau JSON complet.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch {
    return currentPlan;
  }
};

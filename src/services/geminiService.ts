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

  Le plan doit inclure:
  1. Une introduction générale détaillée (problématique, hypothèses, objectifs, méthodologie).
  2. Au moins 3 chapitres structurés.
  3. Une conclusion générale.
  4. Une bibliographie indicative.

  Réponds UNIQUEMENT en format JSON structuré selon ce schéma:
  {
    "introduction_generale": "string",
    "chapitres": [
      {
        "titre": "string",
        "sections": [
          {
            "titre": "string",
            "sous_sections": ["string"]
          }
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
  - Inclus des débats doctrinaux, des théories comparées et des analyses critiques.
  - Adapte le contenu au contexte local (${project.country}) si pertinent.
  - Utilise des citations fictives mais réalistes respectant la norme ${project.norm}.
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

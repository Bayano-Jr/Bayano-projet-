import { Project, Chapter, AppSettings } from '../types';
import { getAuthToken } from '../utils/auth';

const PROJECTS_KEY = 'academiagen_projects';
const CHAPTERS_KEY = 'academiagen_chapters';
const SETTINGS_KEY = 'academiagen_settings';

const getHeaders = async (contentType = 'application/json', isAdmin = false) => {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  const sid = isAdmin ? localStorage.getItem('bayano_admin_token') : await getAuthToken();
  if (sid) {
    headers['Authorization'] = `Bearer ${sid}`;
  }
  return headers;
};

const DEFAULT_SETTINGS: AppSettings = {
  adminPassword: 'admin', // Default password
  aiModel: 'gemini-3.1-pro-preview',
  systemInstruction: "Tu es un expert en rédaction académique. Ton rôle est de rédiger des mémoires de haute qualité, structurés, avec un ton formel et des références précises.",
  appName: 'Bayano Académie',
  appSlogan: 'Excellence & IA'
};

export const storageService = {
  getSettings: async (): Promise<AppSettings> => {
    try {
      const response = await fetch('/api/settings', { 
        headers: await getHeaders(),
        credentials: 'include' 
      });
      if (!response.ok) return DEFAULT_SETTINGS;
      const data = await response.json();
      if (Object.keys(data).length === 0) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...data };
    } catch (err) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: await getHeaders('application/json', true),
      body: JSON.stringify({ settings }),
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Erreur lors de la sauvegarde" }));
      throw new Error(error.error || "Erreur lors de la sauvegarde");
    }
  },

  getProjects: async (): Promise<Project[]> => {
    const response = await fetch('/api/projects', { 
      headers: await getHeaders(),
      credentials: 'include' 
    });
    if (response.status === 401) throw new Error("Non autorisé. Veuillez vous reconnecter.");
    if (!response.ok) return [];
    return response.json();
  },

  getProject: async (id: string): Promise<(Project & { chapters: Chapter[] }) | null> => {
    const response = await fetch(`/api/projects/${id}`, { 
      headers: await getHeaders(),
      credentials: 'include' 
    });
    if (response.status === 401) throw new Error("Non autorisé. Veuillez vous reconnecter.");
    if (!response.ok) return null;
    return response.json();
  },

  getChaptersByProject: async (projectId: string): Promise<Chapter[]> => {
    const response = await fetch(`/api/projects/${projectId}/chapters`, { 
      headers: await getHeaders(),
      credentials: 'include' 
    });
    if (!response.ok) return [];
    return response.json();
  },

  saveProject: async (project: Project): Promise<void> => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(project),
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur lors de la sauvegarde du projet' }));
      throw new Error(error.error || 'Erreur lors de la sauvegarde du projet');
    }
  },

  updateProjectPlan: async (id: string, plan: any): Promise<void> => {
    const response = await fetch(`/api/projects/${id}/plan`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify({ plan }),
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur lors de la mise à jour du plan' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour du plan');
    }
  },

  getAllChapters: async (): Promise<Chapter[]> => {
    const response = await fetch('/api/chapters', { 
      headers: await getHeaders(),
      credentials: 'include' 
    });
    if (!response.ok) return [];
    return response.json();
  },

  saveChapter: async (chapter: Chapter, retries = 3): Promise<void> => {
    try {
      const response = await fetch('/api/chapters', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(chapter),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur lors de la sauvegarde du chapitre' }));
        throw new Error(error.error || 'Erreur lors de la sauvegarde du chapitre');
      }
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return storageService.saveChapter(chapter, retries - 1);
      }
      throw err;
    }
  },

  saveWordPreview: async (projectId: string, html: string): Promise<string> => {
    const response = await fetch(`/api/projects/${projectId}/docx`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ html }),
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur lors de la sauvegarde du document' }));
      throw new Error(error.error || 'Erreur lors de la sauvegarde du document');
    }
    const data = await response.json();
    return data.docx_data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
      credentials: 'include'
    });
  },

  getChatSessions: async (): Promise<any[]> => {
    const response = await fetch('/api/chat-sessions', { 
      headers: await getHeaders(),
      credentials: 'include' 
    });
    if (!response.ok) return [];
    return response.json();
  },

  saveChatSession: async (session: any): Promise<void> => {
    const response = await fetch('/api/chat-sessions', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(session),
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur lors de la sauvegarde de la discussion' }));
      throw new Error(error.error || 'Erreur lors de la sauvegarde de la discussion');
    }
  },

  deleteChatSession: async (id: string): Promise<void> => {
    await fetch(`/api/chat-sessions/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
      credentials: 'include'
    });
  }
};

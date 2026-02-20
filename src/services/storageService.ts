import { Project, Chapter } from '../types';

const PROJECTS_KEY = 'academiagen_projects';
const CHAPTERS_KEY = 'academiagen_chapters';

export const storageService = {
  getProjects: (): Project[] => {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getProject: (id: string): (Project & { chapters: Chapter[] }) | null => {
    const projects = storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) return null;

    const allChapters = storageService.getAllChapters();
    const chapters = allChapters.filter(c => c.project_id === id).sort((a, b) => a.order_index - b.order_index);

    return { ...project, chapters };
  },

  saveProject: (project: Project) => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },

  updateProjectPlan: (id: string, plan: any) => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index >= 0) {
      projects[index].plan = JSON.stringify(plan);
      projects[index].status = 'plan_validated';
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    }
  },

  getAllChapters: (): Chapter[] => {
    const data = localStorage.getItem(CHAPTERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveChapter: (chapter: Chapter) => {
    const chapters = storageService.getAllChapters();
    const index = chapters.findIndex(c => c.id === chapter.id);
    if (index >= 0) {
      chapters[index] = chapter;
    } else {
      chapters.push(chapter);
    }
    localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters));
  },

  deleteProject: (id: string) => {
    const projects = storageService.getProjects().filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    const chapters = storageService.getAllChapters().filter(c => c.project_id !== id);
    localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters));
  }
};

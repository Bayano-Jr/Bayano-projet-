export interface User {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled?: boolean;
  plan?: 'free' | 'student' | 'premium';
  credits?: number;
  subscription_expires_at?: string;
  created_at?: string;
  status?: 'active' | 'restricted' | 'banned';
}

export interface AppSettings {
  adminPassword?: string;
  aiModel: string;
  systemInstruction: string;
  appName: string;
  appSlogan: string;
}

export type DocumentType = string;

export interface Project {
  id: string;
  title: string;
  field: string;
  university: string;
  country: string;
  level: string;
  norm: string;
  min_pages: number;
  instructions?: string;
  referenceText?: string;
  methodology?: 'classic' | 'empirical';
  documentType?: DocumentType;
  generationMode?: 'structured' | 'direct';
  language?: string;
  aiModel?: string;
  plan?: string; // JSON string
  status: 'draft' | 'plan_validated' | 'generating' | 'completed';
  docx_data?: string; // Base64 encoded DOCX
  created_at: string;
  chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  project_id: string;
  title: string;
  content: string;
  order_index: number;
  word_count: number;
}

export interface PlanStructure {
  introduction: {
    titre: string;
    sections: {
      titre: string;
      sous_sections: string[];
    }[];
  };
  chapitres: {
    titre: string;
    sections: {
      titre: string;
      sous_sections: string[];
    }[];
  }[];
  conclusion_generale: string;
  annexes?: string[];
  bibliographie_indicative: string[];
}

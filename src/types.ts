export interface Project {
  id: string;
  title: string;
  field: string;
  university: string;
  country: string;
  level: string;
  norm: string;
  min_pages: number;
  plan?: string; // JSON string
  status: 'draft' | 'plan_validated' | 'generating' | 'completed';
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
  introduction_generale: string;
  chapitres: {
    titre: string;
    sections: {
      titre: string;
      sous_sections: string[];
    }[];
  }[];
  conclusion_generale: string;
  bibliographie_indicative: string[];
}

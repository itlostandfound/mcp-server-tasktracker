// Mirrors Task-Tracker/backend/app/schemas.py. Dates/datetimes are ISO strings over JSON.

export interface TrackerResponse {
  id: string;
  name: string;
  client_type: string;
  open_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrackerCreateInput {
  name: string;
  client_type: string;
}

export interface TrackerUpdateInput {
  name?: string;
  client_type?: string;
}

export interface TaskResponse {
  id: string;
  tracker_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  severity: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCreateInput {
  title: string;
  severity?: number;
}

export interface TaskUpdateInput {
  title?: string;
  is_completed?: boolean;
  sort_order?: number;
  severity?: number;
}

export interface NoteResponse {
  id: string;
  task_id: string;
  title: string | null;
  note_date: string;
  content: Record<string, unknown>;
  content_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteCreateInput {
  content: Record<string, unknown>;
  title?: string;
  note_date?: string;
}

export interface NoteUpdateInput {
  title?: string;
  note_date?: string;
  content?: Record<string, unknown>;
}

export interface ChecklistStep {
  id: string;
  name: string;
  type: "text" | "command";
  is_completed?: boolean;
  completed_at?: string | null;
  command?: string | null;
  display_text: string;
  instruction_text?: string | null;
  hide_command?: boolean;
  order?: number;
}

export interface ChecklistItem {
  id: string;
  name: string;
  order?: number;
  steps?: ChecklistStep[];
}

export interface ChecklistResponse {
  id: string;
  name: string;
  is_template: boolean;
  template_id: string | null;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistCreateInput {
  name: string;
  is_template?: boolean;
  items?: ChecklistItem[];
}

export interface ChecklistUpdateInput {
  name?: string;
  items?: ChecklistItem[];
}

export interface CloneChecklistInput {
  checklist_name: string;
  device_list: string[];
}

export interface ProjectStepReferenceResponse {
  id: string;
  step_id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStepReferenceCreateInput {
  title: string;
  url: string;
  description?: string;
}

export interface ProjectStepReferenceUpdateInput {
  title?: string;
  url?: string;
  description?: string;
}

export interface ProjectStepResponse {
  id: string;
  project_id: string;
  title: string;
  content: Record<string, unknown>;
  content_text: string | null;
  position: number;
  is_completed: boolean;
  completed_at: string | null;
  references: ProjectStepReferenceResponse[];
  created_at: string;
  updated_at: string;
}

export interface ProjectStepCreateInput {
  title: string;
  content?: Record<string, unknown>;
  content_text?: string;
}

export interface ProjectStepUpdateInput {
  title?: string;
  content?: Record<string, unknown>;
  content_text?: string;
}

export interface ProjectResponse {
  id: string;
  title: string;
  steps: ProjectStepResponse[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  title: string;
}

export interface ProjectUpdateInput {
  title?: string;
}

export interface StepReorderInput {
  step_ids: string[];
}

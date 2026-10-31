export type TwinMode = "MENTOR" | "CLONE";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  communication_style: string;
  personality_traits: Record<string, number>;
  target_roles: string[];
  updated_at?: string | null;
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  profile?: Profile | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SourceCitation {
  type: string;
  title: string;
  chunk?: string;
  score?: number;
  document_id?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources_cited: SourceCitation[];
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  active_mode: TwinMode;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  val: number;
  color: string;
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta?: Record<string, unknown>;
}

export interface GraphNodeDetails {
  node: GraphNode;
  links: GraphLink[];
  neighbors: GraphNode[];
}

export interface Task {
  id: string;
  milestone_id?: string | null;
  user_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: string;
  estimated_hours: string;
  skill_tags: string;
  completed_at?: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description?: string | null;
  sequence_order: number;
  is_completed: boolean;
  due_date?: string | null;
  tasks: Task[];
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category: string;
  target_date?: string | null;
  status: string;
  progress_percent: number;
  created_at: string;
  milestones: Milestone[];
}

export interface KanbanBoard {
  columns: Record<TaskStatus, Task[]>;
}

export interface MemoryChunk {
  id: string;
  document_id?: string | null;
  user_id: string;
  chroma_id: string;
  chunk_index: number;
  content: string;
  extracted_entities: Record<string, unknown>;
  tags: string;
  created_at: string;
}

export interface PaginatedChunks {
  items: MemoryChunk[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  raw_text_preview?: string | null;
  source_type: string;
  created_at: string;
  chunk_count: number;
}

export interface MemoryStats {
  documents: number;
  chunks: number;
  vectors: number;
}

export interface BenchmarkRole {
  id: string;
  title: string;
  required_count: number;
}

export interface SkillGapItem {
  name: string;
  category: string;
  is_mastered: boolean;
  proficiency: string;
  importance: string;
}

export interface GapAnalysis {
  role_id: string;
  role_title: string;
  match_percent: number;
  mastered_skills: SkillGapItem[];
  in_progress_skills: SkillGapItem[];
  missing_skills: SkillGapItem[];
  total_required: number;
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  focus_skills: string[];
  deliverables: string[];
  resources: string[];
}

export interface RoadmapResponse {
  role_id: string;
  role_title: string;
  weeks: number;
  roadmap: { summary: string; weeks: RoadmapWeek[] };
  gap?: GapAnalysis;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  energy_level: number;
  accomplishments?: string | null;
  blockers?: string | null;
  tomorrow_priorities?: string | null;
  created_at: string;
}

export interface FocusCount {
  skill: string;
  count: number;
}

export interface VelocityPoint {
  date: string;
  completed: number;
}

export interface Metrics {
  period_days: number;
  tasks_total: number;
  tasks_completed: number;
  tasks_completed_recent: number;
  completion_rate: number;
  active_goals: number;
  average_goal_progress: number;
  focus_distribution: FocusCount[];
  velocity: VelocityPoint[];
  energy_average: number;
  streak_days: number;
  skills_indexed: number;
  daily_logs: DailyLog[];
}

export interface WeeklyDebrief {
  week_start: string;
  week_end: string;
  summary: string;
  highlights: string[];
  blockers: string[];
  recommendations: string[];
  tasks_completed: number;
  generated_by: string;
}

export interface ApiError {
  detail?: string;
  error_code?: string;
  timestamp?: string;
}

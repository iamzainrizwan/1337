export type Pool = "core" | "extra" | "custom"
export type Difficulty = "Easy" | "Medium" | "Hard"
export type Status = "not_started" | "reviewing" | "mastered"

export interface Problem {
  id: number
  name: string
  category: string
  difficulty: Difficulty
  url: string
  order_index: number
  pool: Pool
  company_tags: string | null
  status?: Status | null
  stage?: number | null
  next_review_at?: string | null
}

export interface ReviewLogRow extends Problem {
  stage: number
  outcome: string
}

export interface StageInfoEntry {
  label: string
  next_gap: number | null
}

export type StageInfo = Record<string, StageInfoEntry>

export interface Pacing {
  start_date: string
  target_date: string
  target_count: number
  days_remaining: number
  required_rate_today: number
  actual_started: number
  actual_mastered: number
  actual_weighted: number
  remaining_unstarted: number
  suggested_new_count: number
  unrealistic: boolean
  past_deadline: boolean
}

export interface CategoryProgress {
  category: string
  total: number
  mastered: number
  weighted: number
}

export interface DashboardResponse {
  due: Problem[]
  upcoming: Problem[]
  totals: number
  mastered: number
  in_progress: number
  categories: CategoryProgress[]
  stage_info: StageInfo
  today: string
  pacing: Pacing
  suggested: Problem[]
  today_activity: ReviewLogRow[]
  streak: number
}

export interface ProblemsResponse {
  problems: Problem[]
  stage_info: StageInfo
}

export interface ActivityDay {
  date: string
  count: number
}

export interface BurndownPoint {
  date: string
  actual: number | null
  ideal: number
}

export interface DifficultyBucket {
  difficulty: Difficulty
  total: number
  mastered: number
  started: number
}

export interface StatsResponse {
  activity: ActivityDay[]
  burndown: BurndownPoint[]
  difficulty: DifficultyBucket[]
  streak: number
}

export interface BackfillCandidatesResponse {
  problems: Problem[]
  today: string
}

export interface DigestRow {
  name: string
  category: string
  difficulty: Difficulty
  url: string
  stage: number
  next_review_at: string
}

export interface DigestResponse {
  rows: DigestRow[]
  configured: boolean
  to_email: string | null
  send_time: string
  stage_info: StageInfo
}

export interface TimezoneResponse {
  timezone: string
}

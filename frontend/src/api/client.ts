import type {
  BackfillCandidatesResponse,
  DashboardResponse,
  DigestResponse,
  Pacing,
  Problem,
  ProblemsResponse,
  StatsResponse,
  TimezoneResponse,
} from "./types"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Relative (no leading slash) so it resolves against the page's <base
  // href> -- which reflects the reverse-proxy prefix, if any -- rather
  // than always hitting the domain root.
  const res = await fetch(new URL(`api${path}`, document.baseURI), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  dashboard: () => request<DashboardResponse>("/dashboard"),

  problems: (pool: string) => request<ProblemsResponse>(`/problems?pool=${pool}`),

  addProblem: (data: {
    name: string
    url: string
    difficulty: string
    category: string
    company_tag?: string
  }) =>
    request<Problem>("/problems/add", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTags: (id: number, company_tags: string) =>
    request<Problem>(`/problems/${id}/tags`, {
      method: "PATCH",
      body: JSON.stringify({ company_tags }),
    }),

  solve: (id: number) =>
    request<{ ok: boolean }>(`/solve/${id}`, { method: "POST" }),

  review: (id: number, action: "done" | "struggled") =>
    request<{ ok: boolean }>(`/review/${id}/${action}`, { method: "POST" }),

  backfillCandidates: () => request<BackfillCandidatesResponse>("/backfill/candidates"),

  backfill: (data: { problem_id: number; completed_date: string; completed_stage: number }) =>
    request<{ ok: boolean }>("/backfill", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getGoal: () => request<Pacing>("/goal"),

  setGoal: (target_date: string) =>
    request<Pacing>("/goal", {
      method: "POST",
      body: JSON.stringify({ target_date }),
    }),

  stats: () => request<StatsResponse>("/stats"),

  digest: () => request<DigestResponse>("/digest"),

  sendDigestNow: () => request<{ ok: boolean }>("/digest/send-now", { method: "POST" }),

  getTimezone: () => request<TimezoneResponse>("/settings/timezone"),

  setTimezone: (timezone: string) =>
    request<TimezoneResponse>("/settings/timezone", {
      method: "POST",
      body: JSON.stringify({ timezone }),
    }),
}

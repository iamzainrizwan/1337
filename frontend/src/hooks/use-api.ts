import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard })
}

export function useProblems(pool: string) {
  return useQuery({ queryKey: ["problems", pool], queryFn: () => api.problems(pool) })
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: api.stats })
}

export function useBackfillCandidates() {
  return useQuery({ queryKey: ["backfill-candidates"], queryFn: api.backfillCandidates })
}

export function useDigest() {
  return useQuery({ queryKey: ["digest"], queryFn: api.digest })
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["dashboard"] })
    qc.invalidateQueries({ queryKey: ["problems"] })
    qc.invalidateQueries({ queryKey: ["stats"] })
    qc.invalidateQueries({ queryKey: ["backfill-candidates"] })
  }
}

export function useSolve() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => api.solve(id),
    onSuccess: invalidate,
  })
}

export function useReview() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "done" | "struggled" }) =>
      api.review(id, action),
    onSuccess: invalidate,
  })
}

export function useAddProblem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.addProblem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["problems"] }),
  })
}

export function useUpdateTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, company_tags }: { id: number; company_tags: string }) =>
      api.updateTags(id, company_tags),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["problems"] }),
  })
}

export function useBackfill() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: api.backfill,
    onSuccess: invalidate,
  })
}

export function useSetGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.setGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  })
}

export function useSendDigestNow() {
  return useMutation({ mutationFn: api.sendDigestNow })
}

export function useTimezone() {
  return useQuery({ queryKey: ["timezone"], queryFn: api.getTimezone })
}

export function useSetTimezone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.setTimezone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timezone"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

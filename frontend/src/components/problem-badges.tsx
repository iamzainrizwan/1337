import { Badge } from "@/components/ui/badge"
import type { Difficulty, Status } from "@/api/types"

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const variant = difficulty === "Easy" ? "easy" : difficulty === "Medium" ? "medium" : "hard"
  return <Badge variant={variant}>{difficulty}</Badge>
}

export function StatusBadge({
  status,
  overdue = false,
}: {
  status?: Status | null
  overdue?: boolean
}) {
  if (overdue) return <Badge variant="overdue">Overdue</Badge>
  if (status === "mastered") return <Badge variant="mastered">Mastered</Badge>
  if (status === "reviewing") return <Badge variant="reviewing">Reviewing</Badge>
  return <Badge variant="not_started">Not started</Badge>
}

import { useState } from "react"
import { Mail, Send } from "lucide-react"
import { useDigest, useSendDigestNow } from "@/hooks/use-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DifficultyBadge } from "@/components/problem-badges"
import { Badge } from "@/components/ui/badge"

export default function Digest() {
  const { data, isLoading, isError } = useDigest()
  const sendNow = useSendDigestNow()
  const [sent, setSent] = useState(false)

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />
  if (isError || !data)
    return (
      <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">Failed to load digest.</div>
    )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Mail className="size-6 text-red-bright" />
        <h1 className="font-display text-2xl font-bold">Daily digest</h1>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Configuration</CardTitle>
          {data.configured ? (
            <Badge variant="mastered">Configured</Badge>
          ) : (
            <Badge variant="overdue">Not configured</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-fg-dim">
            Sends to <span className="tabular text-fg-bright">{data.to_email ?? "—"}</span> at{" "}
            <span className="tabular text-fg-bright">{data.send_time}</span> daily.
          </p>
          {!data.configured && (
            <p className="text-red-bright text-xs">
              RESEND_API_KEY or DIGEST_TO_EMAIL isn't set — sends are a no-op until configured on the server.
            </p>
          )}
          <Button
            size="lg"
            className="mt-2 w-fit gap-2"
            disabled={sendNow.isPending}
            onClick={() => sendNow.mutate(undefined, { onSuccess: () => setSent(true) })}
          >
            <Send className="size-4" />
            {sendNow.isPending ? "Sending…" : "Send now"}
          </Button>
          {sent && <p className="text-xs text-blue-bright">Digest send triggered.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Due today ({data.rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.rows.length === 0 && (
            <p className="text-fg-dim text-sm">Nothing due today. Clean slate.</p>
          )}
          {data.rows.map((row) => (
            <div
              key={row.url}
              className="flex flex-col gap-1 rounded-lg border border-border bg-bg-alt/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-fg-bright hover:text-red-bright transition-colors"
                >
                  {row.name}
                </a>
                <p className="text-xs text-fg-dim">
                  {row.category} &middot; {data.stage_info[String(row.stage)]?.label}
                </p>
              </div>
              <DifficultyBadge difficulty={row.difficulty} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

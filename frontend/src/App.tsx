import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"

const Dashboard = lazy(() => import("@/pages/dashboard"))
const Problems = lazy(() => import("@/pages/problems"))
const Stats = lazy(() => import("@/pages/stats"))
const Backfill = lazy(() => import("@/pages/backfill"))
const Digest = lazy(() => import("@/pages/digest"))

function PageFallback() {
  return <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />
}

// Reflects the reverse-proxy prefix (if any) injected server-side into the
// page's <base href>, so client-side navigation keeps working under a
// mounted subpath (e.g. nginx `location /1337/`) without a prefix-specific
// build.
const basename = new URL(document.baseURI).pathname.replace(/\/$/, "")

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<PageFallback />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="problems"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Problems />
                </Suspense>
              }
            />
            <Route
              path="stats"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Stats />
                </Suspense>
              }
            />
            <Route
              path="backfill"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Backfill />
                </Suspense>
              }
            />
            <Route
              path="digest"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Digest />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

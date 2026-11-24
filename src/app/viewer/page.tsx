import { Suspense } from "react"
import { SceneViewer } from "@/components/viewer/SceneViewer"

export default function ViewerPage(props: PageProps<"/viewer">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Architectural viewer</h1>
        <p className="text-sm text-muted-foreground">Click an element to inspect its semantic ID.</p>
      </header>
      <Suspense fallback={null}>
        <ViewerContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}

async function ViewerContent({ searchParams }: { searchParams: PageProps<"/viewer">["searchParams"] }) {
  const params = await searchParams
  const model = typeof params.model === "string" ? params.model : null
  return <SceneViewer requestedModel={model} />
}

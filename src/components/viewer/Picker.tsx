"use client"

import type { Selection } from "./ModelScene"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Props = {
  selection: Selection | null
  onClear: () => void
}

export function Picker({ selection, onClear }: Props) {
  if (!selection) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="picker-hint">
        Select an element on the model to inspect it.
      </p>
    )
  }
  const { metadata } = selection
  return (
    <Card size="sm" className="w-full max-w-sm shadow-md" data-testid="selection-card">
      <CardHeader>
        <CardTitle className="font-mono text-sm break-all" data-testid="semantic-id">
          {metadata.name}
        </CardTitle>
        <CardDescription>
          {metadata.semantic
            ? `${metadata.semantic.building} · ${metadata.semantic.level} · ${metadata.semantic.unit} · ${metadata.semantic.type}`
            : "Node name does not match the semantic ID convention"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {Object.entries(metadata.properties).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-mono break-all">{String(value)}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" size="sm" onClick={onClear} className="self-start">
          Clear selection
        </Button>
      </CardContent>
    </Card>
  )
}

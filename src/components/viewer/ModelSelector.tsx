"use client"

import { DEFAULT_MODEL_URL } from "@/lib/viewer/model-url"

type Props = {
  current: string
}

export function ModelSelector({ current }: Props) {
  const isDefault = current === DEFAULT_MODEL_URL
  return (
    <p className="text-xs text-muted-foreground" data-testid="model-source">
      Model: <span className="font-mono">{current}</span>
      {isDefault ? "" : " (override via ?model=)"}
    </p>
  )
}

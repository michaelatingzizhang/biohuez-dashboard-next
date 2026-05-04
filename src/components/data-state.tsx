type DataStateVariant = "empty" | "error" | "info"

const VARIANT_STYLE: Record<DataStateVariant, { border: string; bg: string; title: string }> = {
  empty: { border: "#D8DEE9", bg: "#FFFFFF", title: "#1A1A1A" },
  error: { border: "#C0392B", bg: "#FFF7F7", title: "#8A1F16" },
  info: { border: "#B8D4AE", bg: "#F9FBF8", title: "#2D4A27" },
}

export function DataState({
  title,
  description,
  variant = "empty",
}: {
  title: string
  description?: string
  variant?: DataStateVariant
}) {
  const style = VARIANT_STYLE[variant]

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderLeft: `4px solid ${style.border}`,
        borderRadius: 10,
        padding: 24,
        color: "#666",
      }}
    >
      <div style={{ color: style.title, fontSize: "0.95rem", fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {description ? <div style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>{description}</div> : null}
    </div>
  )
}

export function DataFootnote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.72rem", color: "#999", marginTop: 8 }}>{children}</div>
}

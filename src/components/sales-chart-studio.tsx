"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react"
import { ReportSlide } from "@/components/report-slide"
import { buildCustomModuleSlideKey } from "@/lib/report-library"
import { cn } from "@/lib/utils"

type MetricFormat = "money" | "money2" | "number" | "percent" | "ratio" | "rank"

export interface ChartStudioMetricDef {
  key: string
  label: string
  format: MetricFormat
  color: string
}

export interface ChartStudioDataset {
  key: string
  label: string
  subtitle: string
  xKey: string
  data: Array<Record<string, unknown>>
  metrics: ChartStudioMetricDef[]
  xTickFormatter?: (value: unknown) => string
}

type ChartType = "line" | "area" | "bar"

interface SavedChartModule {
  id: string
  title: string
  datasetKey: string
  chartType: ChartType
  primaryMetric: string
  secondaryMetric: string | null
}

export interface SavedChartStudioModule {
  id: string
  title: string
  datasetKey: string
  chartType: ChartType
  primaryMetric: string
  secondaryMetric: string | null
}

interface DraftModule {
  id?: string
  title: string
  datasetKey: string
  chartType: ChartType
  primaryMetric: string
  secondaryMetric: string | null
}

function defaultDraft(datasets: ChartStudioDataset[]): DraftModule {
  const firstDataset = datasets[0]
  return {
    title: "",
    datasetKey: firstDataset?.key || "",
    chartType: "line",
    primaryMetric: firstDataset?.metrics[0]?.key || "",
    secondaryMetric: firstDataset?.metrics[1]?.key || null,
  }
}

export function readChartStudioModules(storageKey: string): SavedChartStudioModule[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSavedModules(storageKey: string, modules: SavedChartModule[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, JSON.stringify(modules))
}

export function ChartStudio({
  datasets,
  storageKey,
  title = "Custom Chart Modules",
  description = "Build reusable chart cards from the current page datasets and drag them into the order you want.",
  emptyTitle = "No custom charts yet",
  emptyDescription = "Start with Add Chart, pick a dataset and metric pair, then save the module here.",
  draftHint = "Choose a dataset, chart type, and metric mix. Modules save to this browser.",
  titlePlaceholder = "Weekly Demand Story",
  seedSuffix = "Snapshot",
  reportSlidePrefix = "Custom Module",
}: {
  datasets: ChartStudioDataset[]
  storageKey: string
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
  draftHint?: string
  titlePlaceholder?: string
  seedSuffix?: string
  reportSlidePrefix?: string
}) {
  const [modules, setModules] = useState<SavedChartModule[]>([])
  const [editing, setEditing] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [draft, setDraft] = useState<DraftModule>(() => defaultDraft(datasets))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    const saved = readChartStudioModules(storageKey)
    setModules(saved)
    if (!saved.length && datasets.length) {
      const firstDataset = datasets[0]
      const seeded: SavedChartModule[] = [
        {
          id: `module-${Date.now()}`,
          title: `${firstDataset.label} ${seedSuffix}`,
          datasetKey: firstDataset.key,
          chartType: "line",
          primaryMetric: firstDataset.metrics[0]?.key || "",
          secondaryMetric: firstDataset.metrics[1]?.key || null,
        },
      ]
      setModules(seeded)
      writeSavedModules(storageKey, seeded)
    }
  }, [datasets, seedSuffix, storageKey])

  useEffect(() => {
    if (!modules.length) return
    writeSavedModules(storageKey, modules)
  }, [modules, storageKey])

  const datasetsByKey = useMemo(
    () => Object.fromEntries(datasets.map((dataset) => [dataset.key, dataset])),
    [datasets],
  )

  function openCreate() {
    setDraft(defaultDraft(datasets))
    setBuilderOpen(true)
  }

  function openEdit(module: SavedChartModule) {
    setDraft(module)
    setBuilderOpen(true)
  }

  function closeBuilder() {
    setBuilderOpen(false)
    setDraft(defaultDraft(datasets))
  }

  function syncDraftForDataset(nextDatasetKey: string) {
    const dataset = datasetsByKey[nextDatasetKey]
    if (!dataset) return
    setDraft((current) => ({
      ...current,
      datasetKey: nextDatasetKey,
      primaryMetric: dataset.metrics.some((metric) => metric.key === current.primaryMetric)
        ? current.primaryMetric
        : dataset.metrics[0]?.key || "",
      secondaryMetric: dataset.metrics.some((metric) => metric.key === current.secondaryMetric)
        ? current.secondaryMetric
        : dataset.metrics[1]?.key || null,
    }))
  }

  function saveDraft() {
    if (!draft.datasetKey || !draft.primaryMetric) return
    const dataset = datasetsByKey[draft.datasetKey]
    if (!dataset) return
    const title = draft.title.trim() || `${dataset.label} Module`
    const nextModule: SavedChartModule = {
      id: draft.id || `module-${Date.now()}`,
      title,
      datasetKey: draft.datasetKey,
      chartType: draft.chartType,
      primaryMetric: draft.primaryMetric,
      secondaryMetric: draft.secondaryMetric || null,
    }

    setModules((current) => {
      const exists = current.some((item) => item.id === nextModule.id)
      const next = exists
        ? current.map((item) => (item.id === nextModule.id ? nextModule : item))
        : [...current, nextModule]
      writeSavedModules(storageKey, next)
      return next
    })
    closeBuilder()
  }

  function removeModule(id: string) {
    setModules((current) => {
      const next = current.filter((item) => item.id !== id)
      writeSavedModules(storageKey, next)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setModules((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id)
      const newIndex = current.findIndex((item) => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return current
      const next = arrayMove(current, oldIndex, newIndex)
      writeSavedModules(storageKey, next)
      return next
    })
  }

  return (
    <div className={cn("sales-custom-studio", modules.length > 0 && "has-report-slides")}>
      <div className="sales-custom-studio-shell">
      <div className="sales-custom-studio-toolbar">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="sales-custom-studio-actions">
          <button type="button" className="sales-edit-pill" onClick={openCreate}>
            <Plus size={14} />
            <span>Add Chart</span>
          </button>
          <button
            type="button"
            className={cn("sales-edit-pill", editing && "is-active")}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? <Check size={14} strokeWidth={2.5} /> : <Settings2 size={14} />}
            <span>{editing ? "Done" : "Edit Modules"}</span>
          </button>
        </div>
      </div>

      {modules.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modules.map((module) => module.id)} strategy={rectSortingStrategy}>
            <div className="sales-custom-module-grid">
              {modules.map((module) => (
                <SortableChartModuleCard
                  key={module.id}
                  module={module}
                  dataset={datasetsByKey[module.datasetKey]}
                  editing={editing}
                  onEdit={openEdit}
                  onRemove={removeModule}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="sales-custom-empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyDescription}</p>
        </div>
      )}

      {builderOpen ? (
        <div className="sales-chart-builder-backdrop" role="dialog" aria-modal="true">
          <div className="sales-chart-builder">
            <div className="sales-chart-builder-header">
              <div>
                <strong>{draft.id ? "Edit Chart Module" : "New Chart Module"}</strong>
                <p>{draftHint}</p>
              </div>
              <button type="button" className="sales-chart-builder-close" onClick={closeBuilder} aria-label="Close chart builder">
                <X size={16} />
              </button>
            </div>

            <div className="sales-chart-builder-form">
              <label>
                <span>Module Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={titlePlaceholder}
                />
              </label>

              <label>
                <span>Dataset</span>
                <select value={draft.datasetKey} onChange={(event) => syncDraftForDataset(event.target.value)}>
                  {datasets.map((dataset) => (
                    <option key={dataset.key} value={dataset.key}>
                      {dataset.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sales-chart-builder-segmented">
                {(["line", "area", "bar"] as ChartType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={cn(draft.chartType === type && "is-active")}
                    onClick={() => setDraft((current) => ({ ...current, chartType: type }))}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <label>
                <span>Primary Metric</span>
                <select
                  value={draft.primaryMetric}
                  onChange={(event) => setDraft((current) => ({ ...current, primaryMetric: event.target.value }))}
                >
                  {(datasetsByKey[draft.datasetKey]?.metrics || []).map((metric) => (
                    <option key={metric.key} value={metric.key}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Secondary Metric</span>
                <select
                  value={draft.secondaryMetric || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, secondaryMetric: event.target.value || null }))}
                >
                  <option value="">None</option>
                  {(datasetsByKey[draft.datasetKey]?.metrics || [])
                    .filter((metric) => metric.key !== draft.primaryMetric)
                    .map((metric) => (
                      <option key={metric.key} value={metric.key}>
                        {metric.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="sales-chart-builder-footer">
              <button type="button" className="sales-save-pill" onClick={closeBuilder}>Cancel</button>
              <button type="button" className="sales-edit-pill is-active" onClick={saveDraft}>Save Module</button>
            </div>
          </div>
        </div>
      ) : null}
      </div>

      {modules.length ? (
        <div className="chart-studio-report-slides" aria-hidden="true">
          {modules.map((module, moduleIndex) => {
            const dataset = datasetsByKey[module.datasetKey]
            if (!dataset) return null
            const primaryMetric = dataset.metrics.find((metric) => metric.key === module.primaryMetric)
            const secondaryMetric = module.secondaryMetric
              ? dataset.metrics.find((metric) => metric.key === module.secondaryMetric) || null
              : null
            const summaryBits = [
              dataset.subtitle,
              primaryMetric ? `Primary metric: ${primaryMetric.label}.` : null,
              secondaryMetric ? `Secondary metric: ${secondaryMetric.label}.` : null,
            ].filter(Boolean)
            return (
              <ReportSlide
                key={module.id}
                slideKey={buildCustomModuleSlideKey(module.id)}
                title={module.title}
                message={`${reportSlidePrefix} from ${dataset.label}.`}
                watch={summaryBits.join(" ")}
                action="Use this configured module in report mode or the big report builder."
                order={200 + moduleIndex}
                className="chart-studio-report-slide"
              >
                <div className="chart-studio-report-card">
                  <div className="chart-studio-report-card-top">
                    <div>
                      <span>{dataset.label}</span>
                      <strong>{module.title}</strong>
                      {dataset.subtitle ? <small>{dataset.subtitle}</small> : null}
                    </div>
                  </div>
                  <div className="sales-custom-module-chart">
                    <CustomChartRenderer module={module} dataset={dataset} />
                  </div>
                </div>
              </ReportSlide>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function SalesChartStudio({
  datasets,
}: {
  datasets: ChartStudioDataset[]
}) {
  return (
    <ChartStudio
      datasets={datasets}
      storageKey="biohuez:sales-custom-chart-modules"
      description="Build reusable chart cards from the Sales datasets and drag them into the order you want."
      titlePlaceholder="Weekly Demand Story"
      seedSuffix="Snapshot"
      reportSlidePrefix="Sales Custom Module"
    />
  )
}

function SortableChartModuleCard({
  module,
  dataset,
  editing,
  onEdit,
  onRemove,
}: {
  module: SavedChartModule
  dataset?: ChartStudioDataset
  editing: boolean
  onEdit: (module: SavedChartModule) => void
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, disabled: !editing })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
      className={cn(
        "sales-custom-module-card",
        editing && "is-editing",
        editing && "is-sortable",
        editing && isDragging && "is-dragging-module",
      )}
    >
      <div className="sales-custom-module-card-top">
        <div>
          <span>{dataset?.label || "Custom Dataset"}</span>
          <strong>{module.title}</strong>
          {dataset?.subtitle ? <small>{dataset.subtitle}</small> : null}
        </div>
        <div className="sales-custom-module-card-actions">
          <button
            type="button"
            className="sales-custom-module-icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onEdit(module)
            }}
            aria-label={`Edit ${module.title}`}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="sales-custom-module-icon is-danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRemove(module.id)
            }}
            aria-label={`Delete ${module.title}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="sales-custom-module-chart">
        {dataset ? <CustomChartRenderer module={module} dataset={dataset} /> : null}
      </div>
    </div>
  )
}

function CustomChartRenderer({
  module,
  dataset,
}: {
  module: SavedChartModule
  dataset: ChartStudioDataset
}) {
  const primaryMetric = dataset.metrics.find((metric) => metric.key === module.primaryMetric) || dataset.metrics[0]
  const secondaryMetric = module.secondaryMetric
    ? dataset.metrics.find((metric) => metric.key === module.secondaryMetric) || null
    : null
  const useDualAxis = Boolean(secondaryMetric)
  const reversePrimary = primaryMetric?.format === "rank" && !secondaryMetric
  const reverseSecondary = secondaryMetric?.format === "rank"

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={dataset.data} margin={{ top: 8, right: 20, left: 6, bottom: 8 }}>
        <CartesianGrid strokeDasharray="2 5" stroke="#D8DDD7" vertical={false} />
        <XAxis
          dataKey={dataset.xKey}
          tick={{ fontSize: 11, fill: "#6B746C" }}
          tickFormatter={dataset.xTickFormatter}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="primary"
          tick={{ fontSize: 11, fill: "#6B746C" }}
          tickFormatter={(value) => formatChartValue(Number(value), primaryMetric?.format)}
          axisLine={false}
          tickLine={false}
          reversed={reversePrimary}
        />
        {secondaryMetric ? (
          <YAxis
            yAxisId="secondary"
            orientation="right"
            tick={{ fontSize: 11, fill: "#6B746C" }}
            tickFormatter={(value) => formatChartValue(Number(value), secondaryMetric.format)}
            axisLine={false}
            tickLine={false}
            reversed={reverseSecondary}
          />
        ) : null}
        <Tooltip
          contentStyle={{
            border: "1px solid rgba(34, 44, 38, 0.12)",
            borderRadius: 8,
            padding: "7px 9px",
            boxShadow: "0 10px 24px rgba(20, 28, 22, 0.12)",
            fontSize: "0.78rem",
          }}
          formatter={(value: unknown, name: unknown) => {
            const metric = dataset.metrics.find((item) => item.key === name) || primaryMetric
            return [formatTooltipValue(Number(value), metric?.format), metric?.label || String(name)]
          }}
          labelFormatter={(value) => dataset.xTickFormatter ? dataset.xTickFormatter(value) : String(value)}
        />
        <Legend formatter={(value) => dataset.metrics.find((metric) => metric.key === value)?.label || String(value)} />

        {module.chartType === "bar" ? (
          <>
            <Bar yAxisId="primary" dataKey={primaryMetric.key} fill={primaryMetric.color} radius={[4, 4, 0, 0]} name={primaryMetric.key} />
            {secondaryMetric ? (
              <Bar yAxisId={useDualAxis ? "secondary" : "primary"} dataKey={secondaryMetric.key} fill={secondaryMetric.color} radius={[4, 4, 0, 0]} name={secondaryMetric.key} />
            ) : null}
          </>
        ) : module.chartType === "area" ? (
          <>
            <Area type="monotone" yAxisId="primary" dataKey={primaryMetric.key} stroke={primaryMetric.color} fill={primaryMetric.color} fillOpacity={0.14} strokeWidth={2.4} dot={false} connectNulls name={primaryMetric.key} />
            {secondaryMetric ? (
              <Line type="monotone" yAxisId={useDualAxis ? "secondary" : "primary"} dataKey={secondaryMetric.key} stroke={secondaryMetric.color} strokeWidth={2.2} dot={false} connectNulls name={secondaryMetric.key} />
            ) : null}
          </>
        ) : (
          <>
            <Line type="monotone" yAxisId="primary" dataKey={primaryMetric.key} stroke={primaryMetric.color} strokeWidth={2.4} dot={false} connectNulls name={primaryMetric.key} />
            {secondaryMetric ? (
              <Line type="monotone" yAxisId={useDualAxis ? "secondary" : "primary"} dataKey={secondaryMetric.key} stroke={secondaryMetric.color} strokeWidth={2.2} strokeDasharray="4 4" dot={false} connectNulls name={secondaryMetric.key} />
            ) : null}
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function formatChartValue(value: number, format: MetricFormat | undefined) {
  if (!Number.isFinite(value)) return "—"
  switch (format) {
    case "money":
      return `$${Math.round(value).toLocaleString()}`
    case "money2":
      return `$${value.toFixed(2)}`
    case "percent":
      return `${value.toFixed(0)}%`
    case "ratio":
      return `${value.toFixed(1)}x`
    case "rank":
      return `#${Math.round(value).toLocaleString()}`
    default:
      return Math.round(value).toLocaleString()
  }
}

function formatTooltipValue(value: number, format: MetricFormat | undefined) {
  if (!Number.isFinite(value)) return "—"
  switch (format) {
    case "money":
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    case "money2":
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case "percent":
      return `${value.toFixed(1)}%`
    case "ratio":
      return `${value.toFixed(2)}x`
    case "rank":
      return `#${Math.round(value).toLocaleString()}`
    default:
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileUp,
  Info,
  Loader2,
  PartyPopper,
  Rows3,
  Table2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { parseImportFile, parseImportText, runImport } from "@/lib/api";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  PRICING_LABELS,
  type CategoryDTO,
  type ImportFieldKey,
  type ImportFormat,
  type ImportRunResponseDTO,
  type ParseImportResponse,
  type ParsedImportDTO,
  type PricingModel,
  type SqliteTableInfoDTO,
  type ToolStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "source" | "configure" | "preview" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "configure", label: "Map columns" },
  { key: "preview", label: "Preview" },
  { key: "done", label: "Import" },
];

const NONE = "__none__";
const NO_DEFAULT = "__nodefault__";

const FORMAT_CARDS: {
  value: ImportFormat;
  label: string;
  hint: string;
  icon: typeof FileJson;
  accept: string;
  acceptHint: string;
}[] = [
  {
    value: "csv",
    label: "CSV",
    hint: "Comma-separated values",
    icon: FileSpreadsheet,
    accept: ".csv,.txt,text/csv",
    acceptHint: ".csv",
  },
  {
    value: "tsv",
    label: "TSV",
    hint: "Tab-separated — paste straight from a spreadsheet",
    icon: Rows3,
    accept: ".tsv,.txt,text/tab-separated-values",
    acceptHint: ".tsv",
  },
  {
    value: "json",
    label: "JSON",
    hint: "An array of tool objects",
    icon: FileJson,
    accept: ".json,application/json",
    acceptHint: ".json",
  },
  {
    value: "sqlite",
    label: "SQLite",
    hint: "Upload a .db file, then pick a table",
    icon: Database,
    accept: ".db,.sqlite,.sqlite3,.db3",
    acceptHint: ".db / .sqlite",
  },
];

/** Fields a mapping absolutely needs (or sensible defaults kick in). */
const REQUIRED_FIELDS: ImportFieldKey[] = ["name"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ------------------------------------------------------------------ templates

const TEMPLATE_HEADERS = [
  "name",
  "category",
  "url",
  "pricing",
  "shortDescription",
  "description",
  "freePlanLimits",
  "useCases",
  "example",
  "freeTrial",
  "trialNote",
  "status",
];

const TEMPLATE_ROWS: string[][] = [
  [
    "EchoScribe",
    "Audio & Video",
    "https://echoscribe.example.com",
    "FREEMIUM",
    "AI meeting notes with speaker labels",
    "EchoScribe transcribes meetings, labels speakers, and pushes action items to your task tracker.",
    "3 uploads per month",
    "Meeting notes; Podcast summaries",
    "Summarize this 45-minute product meeting into decisions and action items:",
    "yes",
    "14-day Pro trial",
    "PUBLISHED",
  ],
  [
    "PixelForge",
    "Image Generation",
    "https://pixelforge.example.com",
    "PAID",
    "Text-to-image with a lockable style profile",
    "PixelForge keeps characters and art styles consistent across generations.",
    "",
    "Concept art; Marketing visuals",
    "",
    "no",
    "",
    "PUBLISHED",
  ],
  [
    "DataWhisker",
    "Data Analysis",
    "https://datawhisker.example.com",
    "FREE",
    "Ask questions across your CSVs in plain English",
    "",
    "Unlimited queries on files up to 50 MB",
    "",
    "",
    "",
    "",
  ],
];

function buildTemplate(format: ImportFormat): { filename: string; content: string; mime: string } {
  if (format === "json") {
    const tools = TEMPLATE_ROWS.map((row) => {
      const obj: Record<string, unknown> = {};
      const keys = [
        "name",
        "categoryName",
        "officialUrl",
        "pricingModel",
        "shortDescription",
        "description",
        "freePlanLimits",
        "useCases",
        "example",
        "hasFreeTrial",
        "trialNote",
        "status",
      ];
      keys.forEach((k, i) => {
        const v = row[i];
        if (k === "hasFreeTrial") obj[k] = v === "yes";
        else if (v !== "") obj[k] = v;
      });
      return obj;
    });
    return {
      filename: "tools-template.json",
      content: `${JSON.stringify(tools, null, 2)}\n`,
      mime: "application/json",
    };
  }
  const delimiter = format === "tsv" ? "\t" : ",";
  const csvCell = (v: string) => (/["\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [TEMPLATE_HEADERS.join(delimiter)];
  for (const row of TEMPLATE_ROWS) {
    lines.push(row.map((v) => (format === "tsv" ? v : csvCell(v))).join(delimiter));
  }
  return {
    filename: format === "tsv" ? "tools-template.tsv" : "tools-template.csv",
    content: `${lines.join("\n")}\n`,
    mime: format === "tsv" ? "text/tab-separated-values" : "text/csv",
  };
}

function downloadTemplate(format: ImportFormat) {
  const { filename, content, mime } = buildTemplate(format);
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ component

/**
 * Admin bulk-import wizard: pick a source (CSV / TSV / JSON file or pasted text,
 * or an SQLite database), map columns to tool fields, preview validation, import.
 */
export function BulkImport({
  categories,
  onImported,
}: {
  categories: CategoryDTO[];
  onImported: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>("source");
  const [format, setFormat] = useState<ImportFormat>("csv");

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImportDTO | null>(null);
  const [tables, setTables] = useState<SqliteTableInfoDTO[] | null>(null);
  const [sqliteTable, setSqliteTable] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");

  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>({});
  const [defaultStatus, setDefaultStatus] = useState<ToolStatus>("DRAFT");
  const [defaultPricing, setDefaultPricing] = useState<PricingModel>("FREEMIUM");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [autoCreateCategories, setAutoCreateCategories] = useState(false);

  const [preview, setPreview] = useState<ImportRunResponseDTO | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ImportRunResponseDTO | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetSource = useCallback(() => {
    setFile(null);
    setText("");
    setParsed(null);
    setTables(null);
    setSqliteTable(null);
    setParseError(null);
    setSourceLabel("");
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const switchFormat = useCallback(
    (next: ImportFormat) => {
      setFormat(next);
      resetSource();
      setStep("source");
      setResult(null);
    },
    [resetSource]
  );

  const applyParseResponse = useCallback((res: ParseImportResponse, label: string) => {
    setTables(res.tables ?? null);
    if (res.needsTable) {
      setSqliteTable(null);
      return false;
    }
    const next: ParsedImportDTO = {
      format: res.format ?? "csv",
      headers: res.headers ?? [],
      rows: res.rows ?? [],
      totalRows: res.totalRows ?? (res.rows ?? []).length,
      truncated: !!res.truncated,
      warnings: res.warnings ?? [],
    };
    setParsed(next);
    setMapping(res.suggestedMapping ?? {});
    setSourceLabel(label);
    setStep("configure");
    return true;
  }, []);

  const doParse = useCallback(
    async (opts: { file?: File | null; table?: string | null }) => {
      setParsing(true);
      setParseError(null);
      try {
        let res: ParseImportResponse;
        let label: string;
        if (opts.file) {
          res = await parseImportFile(opts.file, {
            format,
            ...(opts.table ? { table: opts.table } : {}),
          });
          label = opts.table ? `${opts.file.name} → ${opts.table}` : opts.file.name;
        } else {
          res = await parseImportText(text, format);
          label = "Pasted text";
        }
        const got = applyParseResponse(res, label);
        if (got) {
          const rows = res.rows?.length ?? 0;
          toast.success(`Parsed ${rows} row${rows === 1 ? "" : "s"} from ${label}`);
        } else {
          toast.info("Database opened — pick a table to continue");
        }
      } catch (e) {
        setParseError(e instanceof Error ? e.message : "Could not parse this data.");
      } finally {
        setParsing(false);
      }
    },
    [applyParseResponse, format, text]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        setParseError(`“${f.name}” is ${formatBytes(f.size)} — keep imports under 10 MB.`);
        return;
      }
      setFile(f);
      setParsed(null);
      setTables(null);
      setSqliteTable(null);
      setText("");
      void doParse({ file: f });
    },
    [doParse]
  );

  const validate = useCallback(async () => {
    if (!parsed) return;
    setValidating(true);
    try {
      const res = await runImport({
        rows: parsed.rows,
        mapping,
        options: {
          defaultStatus,
          defaultPricingModel: defaultPricing,
          defaultCategoryId,
          skipDuplicates,
          autoCreateCategories,
        },
        dryRun: true,
      });
      setPreview(res);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }, [parsed, mapping, defaultStatus, defaultPricing, defaultCategoryId, skipDuplicates, autoCreateCategories]);

  const commit = useCallback(async () => {
    if (!parsed) return;
    setCommitting(true);
    try {
      const res = await runImport({
        rows: parsed.rows,
        mapping,
        options: {
          defaultStatus,
          defaultPricingModel: defaultPricing,
          defaultCategoryId,
          skipDuplicates,
          autoCreateCategories,
        },
        dryRun: false,
      });
      setResult(res);
      setStep("done");
      const { created, failed } = res.summary;
      if (failed > 0) toast.warning(`Imported ${created} tools — ${failed} rows failed`);
      else if (created === 0) toast.info("Nothing was imported");
      else toast.success(`Imported ${created} tool${created === 1 ? "" : "s"}`);
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The import failed");
    } finally {
      setCommitting(false);
    }
  }, [parsed, mapping, defaultStatus, defaultPricing, defaultCategoryId, skipDuplicates, autoCreateCategories, onImported]);

  const restart = useCallback(() => {
    resetSource();
    setMapping({});
    setResult(null);
    setStep("source");
  }, [resetSource]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const activeCard = FORMAT_CARDS.find((c) => c.value === format)!;

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={stepIndex} onJump={(i) => setStep(STEPS[i].key)} />

      {step === "source" && (
        <SourceStep
          format={format}
          onFormat={switchFormat}
          file={file}
          parsing={parsing}
          parseError={parseError}
          tables={tables}
          sqliteTable={sqliteTable}
          text={text}
          onText={setText}
          dragging={dragging}
          onDragging={setDragging}
          onPickFile={() => fileInputRef.current?.click()}
          onFiles={handleFiles}
          onClearFile={resetSource}
          onPickTable={(t) => {
            setSqliteTable(t);
            void doParse({ file, table: t });
          }}
          onParseText={() => void doParse({})}
        />
      )}

      {step === "configure" && parsed && (
        <ConfigureStep
          parsed={parsed}
          sourceLabel={sourceLabel}
          mapping={mapping}
          onMapping={(field, header) => setMapping((m) => ({ ...m, [field]: header }))}
          categories={categories}
          defaultStatus={defaultStatus}
          onDefaultStatus={setDefaultStatus}
          defaultPricing={defaultPricing}
          onDefaultPricing={setDefaultPricing}
          defaultCategoryId={defaultCategoryId}
          onDefaultCategory={setDefaultCategoryId}
          skipDuplicates={skipDuplicates}
          onSkipDuplicates={setSkipDuplicates}
          autoCreateCategories={autoCreateCategories}
          onAutoCreateCategories={setAutoCreateCategories}
          validating={validating}
          onBack={() => setStep("source")}
          onValidate={() => void validate()}
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          preview={preview}
          committing={committing}
          onBack={() => {
            setPreview(null);
            setStep("configure");
          }}
          onCommit={() => void commit()}
        />
      )}

      {step === "done" && result && <DoneStep result={result} defaultStatus={defaultStatus} onRestart={restart} />}

      {/* shared hidden input so dropzone + browse share one source of truth */}
      <input
        ref={fileInputRef}
        type="file"
        accept={activeCard.accept}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

// ------------------------------------------------------------------ stepper

function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: { key: Step; label: string }[];
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Import progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(i)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "border-primary bg-primary text-primary-foreground shadow-sm",
                done && "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10",
                !active && !done && "border-border text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  active ? "bg-primary-foreground/20" : done ? "bg-primary/15 text-primary" : "bg-muted"
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <span className="hidden h-px w-4 bg-border sm:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ step 1

function SourceStep({
  format,
  onFormat,
  file,
  parsing,
  parseError,
  tables,
  sqliteTable,
  text,
  onText,
  dragging,
  onDragging,
  onPickFile,
  onFiles,
  onClearFile,
  onPickTable,
  onParseText,
}: {
  format: ImportFormat;
  onFormat: (f: ImportFormat) => void;
  file: File | null;
  parsing: boolean;
  parseError: string | null;
  tables: SqliteTableInfoDTO[] | null;
  sqliteTable: string | null;
  text: string;
  onText: (t: string) => void;
  dragging: boolean;
  onDragging: (d: boolean) => void;
  onPickFile: () => void;
  onFiles: (files: FileList | null) => void;
  onClearFile: () => void;
  onPickTable: (table: string) => void;
  onParseText: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* format cards */}
      <div>
        <h2 className="text-lg font-semibold">Where is the data coming from?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a file or paste its contents — column names like <code className="rounded bg-muted px-1 font-mono text-xs">name</code>,{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">url</code> or{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">pricing</code> are recognized automatically.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label="Import format">
          {FORMAT_CARDS.map((card) => {
            const Icon = card.icon;
            const active = format === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onFormat(card.value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="font-semibold leading-none">{card.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{card.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload a ${format.toUpperCase()} file`}
        onClick={onPickFile}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPickFile();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          onDragging(true);
        }}
        onDragLeave={() => onDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
          parsing && "pointer-events-none opacity-70"
        )}
      >
        {parsing ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Parsing…</p>
          </>
        ) : file ? (
          <>
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileUp className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 max-w-full truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            <span
              role="button"
              tabIndex={0}
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation();
                onClearFile();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onClearFile();
                }
              }}
              className="mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
            >
              <X className="size-3" aria-hidden="true" /> Remove
            </span>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium">
              Drop your {activeFormatLabel(format)} file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Max 10 MB · up to 1,000 rows per import</p>
          </>
        )}
      </div>

      {parseError && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Couldn’t read that data</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* sqlite table picker */}
      {tables && tables.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" aria-hidden="true" />
              Pick a table
            </CardTitle>
            <CardDescription>
              This database has {tables.length} tables — choose the one holding your tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tables.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => onPickTable(t.name)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-3",
                  sqliteTable === t.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <span className="flex items-center gap-2 font-mono text-sm font-medium">
                  <Table2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t.name}
                </span>
                <Badge variant="outline" className="w-fit font-normal text-muted-foreground">
                  {t.rowCount.toLocaleString()} rows
                </Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {t.columns.slice(0, 6).join(" · ")}
                  {t.columns.length > 6 ? ` · +${t.columns.length - 6} more` : ""}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* paste area (not for sqlite) */}
      {format !== "sqlite" && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="import-paste" className="text-sm font-medium">
              …or paste {format.toUpperCase()} data directly
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={() => downloadTemplate(format)}
            >
              <Download className="size-3.5" aria-hidden="true" />
              {format.toUpperCase()} template
            </Button>
          </div>
          <Textarea
            id="import-paste"
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={
              format === "json"
                ? '[\n  { "name": "EchoScribe", "category": "Audio & Video", "url": "https://…", "pricing": "FREEMIUM", … },\n  …\n]'
                : `name,category,url,pricing,status\nEchoScribe,Audio & Video,https://echoscribe.example.com,FREEMIUM,PUBLISHED\n…`
            }
            className="mt-2 font-mono text-xs"
            aria-label={`Paste ${format.toUpperCase()} data`}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Tip: copying a range straight from Excel or Google Sheets gives you TSV.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!text.trim() || parsing}
              onClick={onParseText}
              className="gap-1.5"
            >
              {parsing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-3.5" aria-hidden="true" />}
              Parse pasted data
            </Button>
          </div>
        </div>
      )}

      {format === "sqlite" && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          SQLite files are read on the server, table by table — your main catalog database is never touched.
        </p>
      )}
    </div>
  );
}

function activeFormatLabel(format: ImportFormat): string {
  return format === "sqlite" ? "SQLite" : format.toUpperCase();
}

// ------------------------------------------------------------------ step 2

function ConfigureStep({
  parsed,
  sourceLabel,
  mapping,
  onMapping,
  categories,
  defaultStatus,
  onDefaultStatus,
  defaultPricing,
  onDefaultPricing,
  defaultCategoryId,
  onDefaultCategory,
  skipDuplicates,
  onSkipDuplicates,
  autoCreateCategories,
  onAutoCreateCategories,
  validating,
  onBack,
  onValidate,
}: {
  parsed: ParsedImportDTO;
  sourceLabel: string;
  mapping: Partial<Record<ImportFieldKey, string>>;
  onMapping: (field: ImportFieldKey, header: string | undefined) => void;
  categories: CategoryDTO[];
  defaultStatus: ToolStatus;
  onDefaultStatus: (s: ToolStatus) => void;
  defaultPricing: PricingModel;
  onDefaultPricing: (p: PricingModel) => void;
  defaultCategoryId: string;
  onDefaultCategory: (id: string) => void;
  skipDuplicates: boolean;
  onSkipDuplicates: (v: boolean) => void;
  autoCreateCategories: boolean;
  onAutoCreateCategories: (v: boolean) => void;
  validating: boolean;
  onBack: () => void;
  onValidate: () => void;
}) {
  const nameMapped = !!mapping.name;
  const unmappedCount = IMPORT_FIELDS.length - Object.keys(mapping).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Map the columns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{parsed.rows.length.toLocaleString()}</span> rows ·{" "}
            <span className="font-medium text-foreground">{parsed.headers.length}</span> columns · from{" "}
            <span className="font-mono text-xs">{sourceLabel || "your data"}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Change source
        </Button>
      </div>

      {parsed.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Heads-up while parsing</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-0.5">
              {parsed.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Columns → tool fields</CardTitle>
          <CardDescription>
            Recognized columns are pre-mapped — adjust anything that looks off.
            {unmappedCount > 0 && ` ${unmappedCount} field${unmappedCount === 1 ? "" : "s"} left unmapped.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((field) => {
              const required = REQUIRED_FIELDS.includes(field);
              const mapped = mapping[field];
              return (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`map-${field}`} className="text-xs font-medium">
                    {IMPORT_FIELD_LABELS[field]}
                    {required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapped ?? NONE}
                    onValueChange={(v) => onMapping(field, v === NONE ? undefined : v)}
                  >
                    <SelectTrigger id={`map-${field}`} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE} className="text-muted-foreground">
                        — not mapped —
                      </SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapped && parsed.rows[0]?.[mapped] !== undefined && (
                    <p className="truncate text-xs text-muted-foreground" title={parsed.rows[0][mapped]}>
                      e.g. “{parsed.rows[0][mapped] || "∅"}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Defaults & rules</CardTitle>
          <CardDescription>Applied to rows that don’t provide a value (or provide an unknown one).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-default-status" className="text-xs font-medium">
                Default status
              </Label>
              <Select value={defaultStatus} onValueChange={(v) => onDefaultStatus(v as ToolStatus)}>
                <SelectTrigger id="import-default-status" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft — review before going live</SelectItem>
                  <SelectItem value="PUBLISHED">Published — live immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-default-pricing" className="text-xs font-medium">
                Default pricing
              </Label>
              <Select value={defaultPricing} onValueChange={(v) => onDefaultPricing(v as PricingModel)}>
                <SelectTrigger id="import-default-pricing" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="FREEMIUM">Freemium</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-default-category" className="text-xs font-medium">
                Fallback category
              </Label>
              <Select value={defaultCategoryId || NO_DEFAULT} onValueChange={(v) => onDefaultCategory(v === NO_DEFAULT ? "" : v)}>
                <SelectTrigger id="import-default-category" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_DEFAULT} className="text-muted-foreground">
                    No fallback
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <Switch
                checked={skipDuplicates}
                onCheckedChange={onSkipDuplicates}
                aria-label="Skip duplicate tools"
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Skip duplicates</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Rows whose name or website matches an existing tool (or an earlier row) are skipped.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <Switch
                checked={autoCreateCategories}
                onCheckedChange={onAutoCreateCategories}
                aria-label="Auto-create unknown categories"
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Auto-create categories</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Category values that don’t match an existing category get created on the fly.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {!nameMapped ? (
            <span className="text-destructive">Map the “Name” column first — every tool needs one.</span>
          ) : (
            <>Ready to check {parsed.rows.length.toLocaleString()} rows against the catalog.</>
          )}
        </p>
        <Button size="lg" className="gap-1.5" disabled={!nameMapped || validating} onClick={onValidate}>
          {validating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
          Validate & preview
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step 3

function RowOutcomeBadge({ row }: { row: ImportRunResponseDTO["rows"][number] }) {
  if (row.status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-red-300/60 font-normal text-red-700 dark:border-red-700/60 dark:text-red-300">
        <X className="size-3" aria-hidden="true" /> Invalid
      </Badge>
    );
  }
  if (row.duplicate) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300/70 font-normal text-amber-700 dark:border-amber-700/60 dark:text-amber-300">
        <Info className="size-3" aria-hidden="true" /> Duplicate
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-300/60 font-normal text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300">
      <Check className="size-3" aria-hidden="true" /> Ready
    </Badge>
  );
}

function PreviewStep({
  preview,
  committing,
  onBack,
  onCommit,
}: {
  preview: ImportRunResponseDTO;
  committing: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const { summary } = preview;
  const chips: { label: string; value: number; tone: "emerald" | "amber" | "red" | "muted" }[] = [
    { label: summary.importable === 1 ? "tool ready" : "tools ready", value: summary.importable, tone: "emerald" },
    { label: "duplicates", value: summary.duplicates, tone: "amber" },
    { label: "invalid rows", value: summary.errors, tone: "red" },
    { label: "new categories", value: summary.categoriesCreated.length, tone: "muted" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing has been written yet — this is exactly what the import will do.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to settings
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
        {chips.map((c) => (
          <span
            key={c.label}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              c.tone === "emerald" && "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300",
              c.tone === "amber" && "border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300",
              c.tone === "red" && "border-red-300/60 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300",
              c.tone === "muted" && "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            {c.value.toLocaleString()} {c.label}
          </span>
        ))}
      </div>

      {summary.categoriesCreated.length > 0 && (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>{summary.categoriesCreated.length} categor{summary.categoriesCreated.length === 1 ? "y" : "ies"} will be created</AlertTitle>
          <AlertDescription>
            {summary.categoriesCreated.map((c) => c.name).join(", ")} — they’ll appear in the Categories tab too.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[26rem] overflow-auto scrollbar-slim">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead className="w-24">Result</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Pricing</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="min-w-48">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.index} className={cn(row.status === "error" && "bg-destructive/5")}>
                  <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                    {row.index + 1}
                  </TableCell>
                  <TableCell>
                    <RowOutcomeBadge row={row} />
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate font-medium">{row.name || <em className="text-muted-foreground">unnamed</em>}</span>
                    {row.duplicate && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.duplicateInBatch !== undefined
                          ? `same as row ${row.duplicateInBatch + 1}`
                          : `like “${row.duplicateOfName}”`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-40 truncate text-sm md:table-cell">{row.category || "—"}</TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{row.pricing || "—"}</TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {row.finalStatus === "PUBLISHED" ? "Published" : "Draft"}
                  </TableCell>
                  <TableCell className="min-w-48">
                    {row.errors.length === 0 && row.warnings.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {row.errors.map((e, i) => (
                          <li key={`e${i}`} className="text-destructive">
                            {e}
                          </li>
                        ))}
                        {row.warnings.map((w, i) => (
                          <li key={`w${i}`} className="text-muted-foreground">
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary.importable === 0
            ? "Nothing importable — fix the mapping or defaults and re-validate."
            : summary.errors > 0
              ? `${summary.errors} invalid row${summary.errors === 1 ? "" : "s"} will be left out; the rest imports cleanly.`
              : "All clear — review the list above, then run the import."}
        </p>
        <Button size="lg" className="gap-1.5" disabled={summary.importable === 0 || committing} onClick={onCommit}>
          {committing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          Import {summary.importable.toLocaleString()} tool{summary.importable === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step 4

function DoneStep({
  result,
  defaultStatus,
  onRestart,
}: {
  result: ImportRunResponseDTO;
  defaultStatus: ToolStatus;
  onRestart: () => void;
}) {
  const { summary } = result;
  const failures = result.rows.filter((r) => r.status === "error" || r.failedReason);
  const allGood = summary.failed === 0 && summary.errors === 0;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex items-start gap-4 rounded-xl border p-5",
          allGood ? "border-emerald-300/60 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/40" : "border-amber-300/70 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40"
        )}
        role="status"
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            allGood ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
          )}
        >
          {allGood ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <AlertTriangle className="size-5" aria-hidden="true" />}
        </span>
        <div>
          <h2 className="text-lg font-semibold">
            {allGood
              ? `Import complete — ${summary.created} tool${summary.created === 1 ? "" : "s"} added`
              : `Import finished with ${summary.failed + summary.errors} problem${summary.failed + summary.errors === 1 ? "" : "s"}`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {defaultStatus === "DRAFT"
              ? "The new tools are in the Tools tab as drafts — publish them whenever they’re ready."
              : "The new tools are live — visitors can find them in the catalog right away."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DoneStat label="Created" value={summary.created} tone="emerald" />
        <DoneStat label="Duplicates skipped" value={summary.skippedDuplicates} tone="amber" />
        <DoneStat label="Invalid rows" value={summary.errors} tone="red" />
        <DoneStat label="Write failures" value={summary.failed} tone="red" />
      </div>

      {summary.categoriesCreated.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Categories created</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {summary.categoriesCreated.map((c) => (
              <Badge key={c.slug} variant="outline" className="gap-1.5 font-normal">
                <Check className="size-3 text-emerald-600" aria-hidden="true" />
                {c.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {failures.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rows that weren’t imported</CardTitle>
            <CardDescription>Fix these in your source file and import again — already-added tools will be detected as duplicates.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-2 overflow-y-auto scrollbar-slim pr-2">
              {failures.map((r) => (
                <li key={r.index} className="rounded-lg border bg-card p-3 text-sm">
                  <span className="font-medium">
                    Row {r.index + 1}{r.name ? ` — ${r.name}` : ""}
                  </span>
                  <ul className="mt-1 space-y-0.5 text-xs text-destructive">
                    {r.failedReason && <li>{r.failedReason}</li>}
                    {r.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRestart} className="gap-1.5">
          <PartyPopper className="size-4" aria-hidden="true" />
          Import more data
        </Button>
      </div>
    </div>
  );
}

function DoneStat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p
          className={cn(
            "text-2xl font-bold leading-none",
            tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
            tone === "amber" && "text-amber-600 dark:text-amber-400",
            tone === "red" && (value > 0 ? "text-destructive" : "text-muted-foreground"),
            tone === "red" && value === 0 && "text-muted-foreground"
          )}
        >
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

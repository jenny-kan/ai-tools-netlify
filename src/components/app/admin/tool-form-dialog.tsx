"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, Save, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { checkDuplicates, createTool, updateTool, ApiError } from "@/lib/api";
import {
  PRICING_LABELS,
  formatDate,
  type CategoryDTO,
  type PricingModel,
  type ToolDTO,
  type ToolInput,
  type ToolStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { PricingBadge, TrialBadge, StatusBadge } from "../pricing-badge";
import { ToolCard } from "../tool-card";

type FieldKey =
  | "name"
  | "shortDescription"
  | "officialUrl"
  | "categoryId"
  | "pricingModel";

interface FormState {
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  example: string;
  useCases: string;
  officialUrl: string;
  pricingModel: "" | PricingModel;
  hasFreeTrial: boolean;
  trialNote: string;
  freePlanLimits: string;
  pricingLastChecked: string; // yyyy-mm-dd
}

function toForm(tool: ToolDTO | null): FormState {
  if (tool) {
    return {
      name: tool.name,
      categoryId: tool.categoryId,
      shortDescription: tool.shortDescription,
      description: tool.description,
      example: tool.example,
      useCases: tool.useCases,
      officialUrl: tool.officialUrl,
      pricingModel: tool.pricingModel,
      hasFreeTrial: tool.hasFreeTrial,
      trialNote: tool.trialNote,
      freePlanLimits: tool.freePlanLimits,
      pricingLastChecked: tool.pricingLastChecked.slice(0, 10),
    };
  }
  return {
    name: "",
    categoryId: "",
    shortDescription: "",
    description: "",
    example: "",
    useCases: "",
    officialUrl: "",
    pricingModel: "",
    hasFreeTrial: false,
    trialNote: "",
    freePlanLimits: "",
    pricingLastChecked: new Date().toISOString().slice(0, 10),
  };
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Fields required before publication (checked client- and server-side). */
function validateForPublish(form: FormState): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!form.shortDescription.trim()) errors.shortDescription = "A short description is required.";
  if (!form.officialUrl.trim()) errors.officialUrl = "Official URL is required.";
  else if (!isValidUrl(form.officialUrl))
    errors.officialUrl = "Enter a valid URL starting with https://";
  if (!form.categoryId) errors.categoryId = "Pick a category.";
  if (!form.pricingModel) errors.pricingModel = "Pick a pricing model.";
  return errors;
}

export function ToolFormDialog({
  open,
  onOpenChange,
  tool,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: ToolDTO | null;
  categories: CategoryDTO[];
  onSaved: () => void | Promise<void>;
}) {
  const isEditing = !!tool;
  const [form, setForm] = useState<FormState>(() => toForm(tool));
  const [initial, setInitial] = useState<FormState>(() => toForm(tool));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [duplicates, setDuplicates] = useState<ToolDTO[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [saving, setSaving] = useState<null | "draft" | "publish" | "changes">(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      const f = toForm(tool);
      setForm(f);
      setInitial(f);
      setErrors({});
      setDuplicates([]);
    }
  }, [open, tool]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial]
  );

  // Live duplicate flagging while name/URL changes (debounced, non-blocking).
  useEffect(() => {
    if (!open) return;
    const name = form.name.trim();
    const url = form.officialUrl.trim();
    if (!name && !url) {
      setDuplicates([]);
      return;
    }
    const t = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const dups = await checkDuplicates({
          name: name || undefined,
          url: url || undefined,
          excludeId: tool?.id,
        });
        setDuplicates(dups);
      } catch {
        setDuplicates([]); // non-fatal
      } finally {
        setCheckingDuplicates(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.name, form.officialUrl, open, tool?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as FieldKey];
      return next;
    });
  };

  const buildInput = (status: ToolStatus): ToolInput => ({
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    example: form.example.trim(),
    freePlanLimits: form.freePlanLimits.trim(),
    useCases: form.useCases.trim(),
    officialUrl: form.officialUrl.trim(),
    pricingModel: form.pricingModel || "FREEMIUM",
    hasFreeTrial: form.hasFreeTrial,
    trialNote: form.trialNote.trim(),
    pricingLastChecked: form.pricingLastChecked
      ? new Date(`${form.pricingLastChecked}T00:00:00`).toISOString()
      : new Date().toISOString(),
    categoryId: form.categoryId,
    status,
  });

  const save = async (mode: "draft" | "publish" | "changes") => {
    if (saving) return;

    if (mode === "draft") {
      const draftErrors: Partial<Record<FieldKey, string>> = {};
      if (!form.name.trim()) draftErrors.name = "Give the draft at least a name.";
      if (!form.categoryId) draftErrors.categoryId = "Pick a category (needed even for drafts).";
      if (Object.keys(draftErrors).length > 0) {
        setErrors(draftErrors);
        return;
      }
    }
    if (mode === "publish" || (mode === "changes" && tool?.status === "PUBLISHED")) {
      const e = validateForPublish(form);
      if (Object.keys(e).length > 0) {
        setErrors(e);
        toast.error("A few required fields are missing", {
          description: "Name, description, official URL, category, and pricing model are needed before publication.",
        });
        return;
      }
    }

    setSaving(mode);
    try {
      const status: ToolStatus =
        mode === "publish" ? "PUBLISHED" : mode === "draft" ? "DRAFT" : tool?.status ?? "DRAFT";
      const result = isEditing && tool
        ? await updateTool(tool.id, buildInput(status))
        : await createTool(buildInput(status));

      if (result.duplicates.length > 0) {
        toast.warning("Saved — but it looks like a duplicate", {
          description: `Similar to: ${result.duplicates.map((d) => d.name).join(", ")}`,
        });
      } else if (mode === "publish") {
        toast.success(`“${result.tool.name}” is published and live for visitors`);
      } else if (mode === "draft") {
        toast.success("Draft saved — publish it when it’s ready");
      } else {
        toast.success("Changes saved");
      }

      await onSaved();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body.missing)) {
        toast.error(e.message, {
          description: `Missing: ${(e.body.missing as string[]).join(", ")}`,
        });
      } else {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const previewTool: ToolDTO = useMemo(() => {
    const category =
      categories.find((c) => c.id === form.categoryId) ??
      ({ id: "preview", name: "Category", slug: "category", icon: "Sparkles" } as CategoryDTO);
    return {
      id: "preview",
      slug: "preview",
      name: form.name.trim() || "Tool name",
      shortDescription:
        form.shortDescription.trim() || "Short description appears here — this is what visitors see on the card.",
      description: form.description,
      example: form.example,
      freePlanLimits: form.freePlanLimits,
      useCases: form.useCases,
      officialUrl: form.officialUrl || "https://example.com",
      pricingModel: form.pricingModel || "FREEMIUM",
      hasFreeTrial: form.hasFreeTrial,
      trialNote: form.trialNote,
      pricingLastChecked: form.pricingLastChecked
        ? new Date(`${form.pricingLastChecked}T00:00:00`).toISOString()
        : new Date().toISOString(),
      status: "PUBLISHED",
      categoryId: category.id,
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [form, categories]);

  const fieldError = (key: FieldKey) =>
    errors[key] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[key]}
      </p>
    ) : null;

  const isPublishedEdit = isEditing && tool.status === "PUBLISHED";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
            <DialogHeader className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DialogTitle>{isEditing ? `Edit “${tool.name}”` : "Add a new tool"}</DialogTitle>
                {isEditing && <StatusBadge status={tool.status} />}
              </div>
              <DialogDescription>
                {isEditing
                  ? "Update the listing. Changes go live for visitors immediately when saved."
                  : "Save as a draft to keep working, or fill in the required fields and publish."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            {/* duplicate warning */}
            {duplicates.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/40"
              >
                <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  Possible duplicate{duplicates.length > 1 ? "s" : ""} found
                </p>
                <ul className="mt-1.5 space-y-1 pl-6 text-amber-800/90 dark:text-amber-300/90">
                  {duplicates.map((d) => (
                    <li key={d.id} className="list-disc">
                      <span className="font-medium">{d.name}</span> — {d.status.toLowerCase()}
                      {d.category?.name ? ` · ${d.category.name}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-amber-700/80 dark:text-amber-400/80">
                  You can still save — this is a warning, not a block.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tool-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tool-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Otter.ai"
                  aria-invalid={!!errors.name}
                  autoFocus
                />
                {fieldError("name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                  <SelectTrigger id="tool-category" aria-invalid={!!errors.categoryId}>
                    <SelectValue placeholder="Choose a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No categories yet — create one in the Categories tab first.
                  </p>
                )}
                {fieldError("categoryId")}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tool-short">
                  Short description <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">{form.shortDescription.length}/200</span>
              </div>
              <Textarea
                id="tool-short"
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value.slice(0, 200))}
                rows={2}
                placeholder="Plain language, 1–2 sentences — shown on the card and in search results."
                aria-invalid={!!errors.shortDescription}
              />
              {fieldError("shortDescription")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-description">What it does (longer)</Label>
              <Textarea
                id="tool-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="A fuller explanation for the detail page — what the tool does, its standout features."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-example">One practical example</Label>
              <Textarea
                id="tool-example"
                value={form.example}
                onChange={(e) => set("example", e.target.value)}
                rows={2}
                placeholder="e.g. Paste your meeting notes and ask it to draft a follow-up email."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-usecases">Use cases (comma separated)</Label>
              <Input
                id="tool-usecases"
                value={form.useCases}
                onChange={(e) => set("useCases", e.target.value)}
                placeholder="e.g. transcribe a meeting, record interviews, meeting notes"
              />
              <p className="text-xs text-muted-foreground">
                Powers search — think of the tasks people would type.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tool-pricing">
                  Pricing model <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.pricingModel}
                  onValueChange={(v) => set("pricingModel", v as PricingModel)}
                >
                  <SelectTrigger id="tool-pricing" aria-invalid={!!errors.pricingModel}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRICING_LABELS) as PricingModel[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRICING_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("pricingModel")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-checked">Pricing last checked</Label>
                <Input
                  id="tool-checked"
                  type="date"
                  value={form.pricingLastChecked}
                  onChange={(e) => set("pricingLastChecked", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="tool-trial" className="cursor-pointer">
                    Offers a free trial
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Shown as a separate badge from the pricing label.
                  </p>
                </div>
                <Switch
                  id="tool-trial"
                  checked={form.hasFreeTrial}
                  onCheckedChange={(v) => set("hasFreeTrial", v)}
                  aria-label="Toggle free trial"
                />
              </div>
              {form.hasFreeTrial && (
                <Input
                  value={form.trialNote}
                  onChange={(e) => set("trialNote", e.target.value)}
                  placeholder="e.g. 14-day free trial"
                  aria-label="Free trial details"
                />
              )}
            </div>

            {form.pricingModel !== "PAID" && (
              <div className="space-y-2">
                <Label htmlFor="tool-freelimits">
                  {form.pricingModel === "FREE" ? "Why it’s free" : "Free plan limits"}
                </Label>
                <Textarea
                  id="tool-freelimits"
                  value={form.freePlanLimits}
                  onChange={(e) => set("freePlanLimits", e.target.value)}
                  rows={2}
                  placeholder={
                    form.pricingModel === "FREE"
                      ? "e.g. Completely free and open source."
                      : "e.g. 300 minutes of transcription per month."
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tool-url">
                Official URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tool-url"
                type="url"
                value={form.officialUrl}
                onChange={(e) => set("officialUrl", e.target.value)}
                placeholder="https://example.com"
                aria-invalid={!!errors.officialUrl}
              />
              {checkingDuplicates && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Checking for duplicates…
                </p>
              )}
              {fieldError("officialUrl")}
            </div>
          </div>

          <div className="sticky bottom-0 border-t bg-background/95 px-6 py-4 backdrop-blur">
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!form.name.trim() && !form.shortDescription.trim()}
              >
                <Eye className="size-4" aria-hidden="true" />
                Preview
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={saving !== null}
                >
                  Cancel
                </Button>
                {(isPublishedEdit || (isEditing && tool.status === "ARCHIVED")) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving !== null}
                    onClick={() => void save("changes")}
                  >
                    {saving === "changes" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save changes
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving !== null}
                    onClick={() => void save("draft")}
                  >
                    {saving === "draft" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save draft
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void save(isPublishedEdit ? "changes" : "publish")}
                  className={cn(isPublishedEdit && "")}
                >
                  {saving === "publish" || saving === "changes" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {isPublishedEdit ? "Update & keep live" : "Publish"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview — {previewTool.name}</DialogTitle>
            <DialogDescription>
              Exactly how visitors will see this listing. Nothing is saved yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="pointer-events-none">
              <ToolCard tool={previewTool} className="w-full" />
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <PricingBadge model={previewTool.pricingModel} />
                {previewTool.hasFreeTrial && <TrialBadge note={previewTool.trialNote} showNote />}
                <span className="text-xs text-muted-foreground">
                  Pricing checked {formatDate(previewTool.pricingLastChecked)}
                </span>
              </div>
              {previewTool.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What it does
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{previewTool.description}</p>
                </div>
              )}
              {previewTool.example && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Try this
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{previewTool.example}</p>
                </div>
              )}
              {previewTool.freePlanLimits && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Free plan limits
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{previewTool.freePlanLimits}</p>
                </div>
              )}
              <Badge variant="outline" className="font-normal text-muted-foreground">
                “Visit official website” button → {previewTool.officialUrl}
              </Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* discard guard */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ve made changes that haven’t been saved yet. Closing now will throw them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmDiscard(false); onOpenChange(false); }}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

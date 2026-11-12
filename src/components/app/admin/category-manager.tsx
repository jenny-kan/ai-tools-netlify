"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createCategory, deleteCategory, updateCategory } from "@/lib/api";
import type { CategoryDTO } from "@/lib/types";
import { CATEGORY_ICON_OPTIONS, CategoryIcon } from "../category-icon";

interface CategoryForm {
  name: string;
  description: string;
  icon: string;
}

const EMPTY_FORM: CategoryForm = { name: "", description: "", icon: "Sparkles" };

export function CategoryManager({
  categories,
  onChanged,
}: {
  categories: CategoryDTO[];
  onChanged: () => void | Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      setForm(
        editing
          ? { name: editing.name, description: editing.description, icon: editing.icon }
          : EMPTY_FORM
      );
      setError(null);
    }
  }, [dialogOpen, editing]);

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success(`Category “${form.name}” updated`);
      } else {
        await createCategory(form);
        toast.success(`Category “${form.name}” created`);
      }
      setDialogOpen(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (category: CategoryDTO) => {
    if (category.toolCount > 0) {
      toast.error(`Can’t delete “${category.name}”`, {
        description: `${category.toolCount} ${category.toolCount === 1 ? "tool" : "tools"} still use this category — reassign or delete them first.`,
      });
      return;
    }
    setDeleting(category);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory(deleting.id);
      toast.success(`Category “${deleting.name}” deleted`);
      setDeleting(null);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <FolderTree className="size-4 text-primary" aria-hidden="true" />
            Categories
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Organize the directory — names and icons appear on cards and filters instantly.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add category
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CategoryIcon icon={c.icon} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold leading-tight">{c.name}</h3>
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  /{c.slug}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 font-normal text-primary"
                >
                  {c.toolCount} {c.toolCount === 1 ? "tool" : "tools"}
                </Badge>
              </div>
              {c.description && (
                <p className="mt-0.5 hidden line-clamp-1 text-sm text-muted-foreground sm:block">
                  {c.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(c);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Delete category ${c.name}`}
                onClick={() => requestDelete(c)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No categories yet — add one to start organizing tools.
          </li>
        )}
      </ul>

      {/* add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit “${editing.name}”` : "Add a category"}</DialogTitle>
            <DialogDescription>
              Categories power the homepage filter pills and card labels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 3D & Design"
                autoFocus
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="One line about the kinds of tools in this category."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                <SelectTrigger id="cat-icon" className="w-full">
                  <SelectValue placeholder="Choose an icon…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={icon} className="size-4 text-primary" />
                        {icon}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm — only reachable for empty categories */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This category has no tools assigned, so it’s safe to delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

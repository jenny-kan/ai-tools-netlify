"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Copy,
  EyeOff,
  FolderTree,
  Inbox,
  Loader2,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  UserPlus,
  Wrench,
} from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminLogin,
  adminLogout,
  deleteTool,
  getAdminBlogOverview,
  getAdminCategories,
  getAdminMessages,
  getAdminSession,
  getAdminTools,
  setToolStatus,
  ApiError,
} from "@/lib/api";
import {
  formatDate,
  type AdminBlogOverviewDTO,
  type CategoryDTO,
  type ContactMessageDTO,
  type ToolDTO,
  type ToolStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppData } from "../data-context";
import { CategoryIcon } from "../category-icon";
import { PricingBadge, StatusBadge } from "../pricing-badge";
import { CategoryManager } from "./category-manager";
import { MessagesInbox } from "./messages-inbox";
import { ToolFormDialog } from "./tool-form-dialog";
import { BulkImport } from "./bulk-import";
import { BlogManager } from "./blog-manager";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { DonationsManager } from "./donations-manager";

export function AdminView() {
  const [authState, setAuthState] = useState<"checking" | "logged-out" | "logged-in">("checking");
  const [demoPassword, setDemoPassword] = useState<string | null>(null);
  const [adminDisabled, setAdminDisabled] = useState(false);

  useEffect(() => {
    getAdminSession()
      .then((s) => {
        setAuthState(s.authenticated ? "logged-in" : "logged-out");
        if (typeof s.demoPassword === "string") setDemoPassword(s.demoPassword);
        setAdminDisabled(s.disabled === true);
      })
      .catch(() => setAuthState("logged-out"));
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Checking admin session">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authState === "logged-out") {
    return <AdminLogin demoPassword={demoPassword} disabled={adminDisabled} onSuccess={() => setAuthState("logged-in")} />;
  }

  return <AdminDashboard onLogout={() => setAuthState("logged-out")} />;
}

// ------------------------------------------------------------------ login

function AdminLogin({
  demoPassword,
  disabled,
  onSuccess,
}: {
  demoPassword: string | null;
  disabled: boolean;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyDemo = async () => {
    if (!demoPassword) return;
    try {
      await navigator.clipboard.writeText(demoPassword);
      setCopied(true);
      toast.success("Demo password copied — paste it into the field below");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text manually");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminLogin(password);
      toast.success("Signed in — welcome back");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 pb-16 pt-14 sm:px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-2">Admin sign in</CardTitle>
          <CardDescription>
            Enter the admin password to manage the tool catalog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !password}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Sign in
            </Button>
            {disabled ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-left">
              <p className="text-xs font-medium text-destructive">
                Admin access is disabled on this server
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set <code className="rounded bg-muted px-1">ADMIN_PASSWORD</code> (48+ chars)
                and <code className="rounded bg-muted px-1">ADMIN_SECRET</code> environment
                variables to enable the dashboard.
              </p>
            </div>
          ) : (
          <div className="rounded-lg border bg-muted/40 p-3 text-left">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
                Admin policy: 48+ character passwords — even in the demo.
              </p>
              {demoPassword ? (
                <div className="mt-2 space-y-2">
                  <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                    {demoPassword}
                  </code>
                  <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => void copyDemo()}>
                    {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                    {copied ? "Copied" : "Copy demo password"}
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  This server uses a custom ADMIN_PASSWORD environment variable.
                </p>
              )}
            </div>
          )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------- dashboard

type StatusFilter = "all" | ToolStatus;

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { refresh: refreshPublic } = useAppData();
  const [tools, setTools] = useState<ToolDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [messages, setMessages] = useState<ContactMessageDTO[]>([]);
  const [blogOverview, setBlogOverview] = useState<AdminBlogOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolDTO | null>(null);
  const [deletingTool, setDeletingTool] = useState<ToolDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [t, c, m, b] = await Promise.all([
        getAdminTools(),
        getAdminCategories(),
        getAdminMessages(),
        getAdminBlogOverview(),
      ]);
      setTools(t);
      setCategories(c);
      setMessages(m);
      setBlogOverview(b);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Reload admin data + the public catalog so visitors see changes immediately. */
  const afterChange = useCallback(async () => {
    await Promise.all([loadAll(), refreshPublic()]);
  }, [loadAll, refreshPublic]);

  const stats = useMemo(
    () => ({
      published: tools.filter((t) => t.status === "PUBLISHED").length,
      drafts: tools.filter((t) => t.status === "DRAFT").length,
      archived: tools.filter((t) => t.status === "ARCHIVED").length,
      total: tools.length,
      unread: messages.filter((m) => m.status === "NEW").length,
      // Writer applications waiting for an approve/reject decision — surfaced
      // on the Blog tab badge, mirroring the Inbox unread count.
      pendingWriters: (blogOverview?.applications ?? []).filter((a) => a.status === "PENDING").length,
    }),
    [tools, messages, blogOverview]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const order: Record<ToolStatus, number> = { PUBLISHED: 0, DRAFT: 1, ARCHIVED: 2 };
    return tools
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.shortDescription.toLowerCase().includes(q) ||
          (t.category?.name ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name)
      );
  }, [tools, statusFilter, search]);

  const changeStatus = async (tool: ToolDTO, status: ToolStatus) => {
    setBusyId(tool.id);
    try {
      await setToolStatus(tool.id, status);
      if (status === "PUBLISHED") toast.success(`“${tool.name}” is now live for visitors`);
      else if (status === "ARCHIVED") toast.success(`“${tool.name}” archived — hidden from visitors`);
      else toast.success(`“${tool.name}” moved to drafts`);
      await afterChange();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body.missing)) {
        toast.error(e.message, {
          description: `Missing: ${(e.body.missing as string[]).join(", ")}`,
        });
      } else {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingTool) return;
    const tool = deletingTool;
    setBusyId(tool.id);
    try {
      await deleteTool(tool.id);
      toast.success(`“${tool.name}” deleted`);
      await afterChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingTool(null);
      setBusyId(null);
    }
  };

  const logout = async () => {
    try {
      await adminLogout();
    } finally {
      onLogout();
    }
  };

  const statusTabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "PUBLISHED", label: "Published", count: stats.published },
    { value: "DRAFT", label: "Drafts", count: stats.drafts },
    { value: "ARCHIVED", label: "Archived", count: stats.archived },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin dashboard</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage listings — draft, publish, edit pricing, archive, and organize categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void logout()} className="text-muted-foreground">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
          <Button size="lg" className="font-semibold" onClick={() => { setEditingTool(null); setFormOpen(true); }}>
            <Plus className="size-4" aria-hidden="true" />
            Add tool
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Published" value={stats.published} icon={<Rocket className="size-4" />} />
        <StatCard label="Drafts" value={stats.drafts} icon={<Wrench className="size-4" />} />
        <StatCard label="Archived" value={stats.archived} icon={<Archive className="size-4" />} />
        <StatCard label="Categories" value={categories.length} icon={<FolderTree className="size-4" />} />
        <StatCard
          label="Pending writers"
          value={stats.pendingWriters}
          icon={<UserPlus className="size-4" />}
          highlight={stats.pendingWriters > 0}
        />
        <StatCard label="Unread mail" value={stats.unread} icon={<Inbox className="size-4" />} highlight={stats.unread > 0} />
      </div>

      <Tabs defaultValue="tools" className="mt-8">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto sm:flex-nowrap sm:justify-center">
          <TabsTrigger value="tools" className="flex-1 sm:flex-initial">Tools</TabsTrigger>
          <TabsTrigger value="import" className="flex-1 sm:flex-initial">Import</TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 sm:flex-initial">Categories</TabsTrigger>
          <TabsTrigger value="blog" className="flex-1 gap-1.5 sm:flex-initial">
            Blog
            {/* Always rendered (invisible at 0) so the tab never resizes when
                applications arrive — mirrors the Inbox unread badge. */}
            <span
              aria-hidden={stats.pendingWriters === 0}
              title={stats.pendingWriters > 0 ? `${stats.pendingWriters} awaiting approval` : undefined}
              className={cn(
                "min-w-5 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground",
                stats.pendingWriters === 0 && "invisible"
              )}
            >
              {stats.pendingWriters}
            </span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 sm:flex-initial">Analytics</TabsTrigger>
          <TabsTrigger value="donations" className="flex-1 sm:flex-initial">Donations</TabsTrigger>
          <TabsTrigger value="inbox" className="flex-1 gap-1.5 sm:flex-initial">
            Inbox
            {/* Always rendered (invisible at 0) so the tab never resizes when
                unread mail arrives — avoids layout shift in the tabs row. */}
            <span
              aria-hidden={stats.unread === 0}
              className={cn(
                "min-w-5 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground",
                stats.unread === 0 && "invisible"
              )}
            >
              {stats.unread}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
              {statusTabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={statusFilter === t.value}
                  onClick={() => setStatusFilter(t.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    statusFilter === t.value
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {t.label} · {t.count}
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools…"
                aria-label="Search tools in the dashboard"
                className="h-9 pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => void loadAll()} className="mt-3">
                Try again
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">No tools here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Nothing matches your search." : "Add your first tool to get started."}
              </p>
              <Button className="mt-4" onClick={() => { setEditingTool(null); setFormOpen(true); }}>
                <Plus className="size-4" aria-hidden="true" />
                Add tool
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((tool) => (
                <li key={tool.id}>
                  <AdminToolRow
                    tool={tool}
                    busy={busyId === tool.id}
                    onEdit={() => { setEditingTool(tool); setFormOpen(true); }}
                    onStatus={(s) => void changeStatus(tool, s)}
                    onDelete={() => setDeletingTool(tool)}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <BulkImport categories={categories} onImported={afterChange} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoryManager categories={categories} onChanged={afterChange} />
        </TabsContent>

        <TabsContent value="blog" className="mt-4">
          <BlogManager onChanged={afterChange} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="donations" className="mt-4">
          <DonationsManager />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <MessagesInbox />
        </TabsContent>
      </Tabs>

      {/* tool form */}
      <ToolFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingTool(null);
        }}
        tool={editingTool}
        categories={categories}
        onSaved={afterChange}
      />

      {/* delete confirm */}
      <AlertDialog open={!!deletingTool} onOpenChange={(o) => !o && setDeletingTool(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deletingTool?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the listing from the database. Consider archiving instead —
              archived tools stay out of public view but can be restored anytime.
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
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn("py-4", highlight && "border-primary/50")}>
      <CardContent className="flex items-center gap-3 px-4">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminToolRow({
  tool,
  busy,
  onEdit,
  onStatus,
  onDelete,
}: {
  tool: ToolDTO;
  busy: boolean;
  onEdit: () => void;
  onStatus: (s: ToolStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-opacity md:flex-row md:items-center",
        busy && "pointer-events-none opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold leading-tight">{tool.name}</h3>
          <StatusBadge status={tool.status} />
          {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Working…" />}
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{tool.shortDescription}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:shrink-0">
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <CategoryIcon icon={tool.category?.icon} className="size-3" />
          {tool.category?.name ?? "—"}
        </Badge>
        <PricingBadge model={tool.pricingModel} />
        {tool.hasFreeTrial && (
          <Badge variant="outline" className="border-dashed border-amber-300/70 font-normal text-amber-700 dark:border-amber-700/60 dark:text-amber-300">
            Trial
          </Badge>
        )}
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Updated {formatDate(tool.updatedAt)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${tool.name}`}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {tool.status !== "PUBLISHED" && (
              <DropdownMenuItem onClick={() => onStatus("PUBLISHED")}>
                <Rocket className="size-4" /> Publish
              </DropdownMenuItem>
            )}
            {tool.status === "PUBLISHED" && (
              <DropdownMenuItem onClick={() => onStatus("DRAFT")}>
                <EyeOff className="size-4" /> Unpublish
              </DropdownMenuItem>
            )}
            {tool.status !== "ARCHIVED" && (
              <DropdownMenuItem onClick={() => onStatus("ARCHIVED")}>
                <Archive className="size-4" /> Archive
              </DropdownMenuItem>
            )}
            {tool.status === "ARCHIVED" && (
              <DropdownMenuItem onClick={() => onStatus("DRAFT")}>
                <Undo2 className="size-4" /> Restore to drafts
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

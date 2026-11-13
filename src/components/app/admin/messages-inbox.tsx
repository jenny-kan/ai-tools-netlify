"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Bug,
  CheckCheck,
  Inbox,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquareHeart,
  MoreHorizontal,
  Reply,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteMessage, getAdminMessages, replyToMessage, setMessageStatus } from "@/lib/api";
import {
  CONTACT_REASON_LABELS,
  formatDate,
  type ContactMessageDTO,
  type ContactReason,
  type MessageStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const REASON_STYLES: Record<ContactReason, string> = {
  FEEDBACK: "border-sky-300/60 text-sky-700 dark:border-sky-700/60 dark:text-sky-300",
  ISSUE: "border-red-300/60 text-red-700 dark:border-red-700/60 dark:text-red-300",
  SUGGESTION: "border-violet-300/60 text-violet-700 dark:border-violet-700/60 dark:text-violet-300",
  TOOL_SUGGESTION: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  OTHER: "border-border text-muted-foreground",
};

const REASON_ICONS: Record<ContactReason, React.ReactNode> = {
  FEEDBACK: <MessageSquareHeart className="size-3" />,
  ISSUE: <Bug className="size-3" />,
  SUGGESTION: <Lightbulb className="size-3" />,
  TOOL_SUGGESTION: <Sparkles className="size-3" />,
  OTHER: <Mail className="size-3" />,
};

type StatusFilter = "all" | MessageStatus;

/** Admin inbox for contact-form messages. */
export function MessagesInbox() {
  const [messages, setMessages] = useState<ContactMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContactMessageDTO | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Email reply state — the dialog works on a copy of the message so the
  // list can refresh optimistically once the server confirms the send.
  const [replying, setReplying] = useState<ContactMessageDTO | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const REPLY_MIN = 10;
  const REPLY_MAX = 5000;

  const openReply = (m: ContactMessageDTO) => {
    setReplying(m);
    // Pre-fill a friendly greeting; the admin edits from there.
    setReplyText(`Hi ${m.name.split(" ")[0]},\n\nThanks for reaching out to ai tools central!\n\n`);
  };

  const sendReply = async () => {
    if (!replying || sending) return;
    const text = replyText.trim();
    if (text.length < REPLY_MIN) {
      toast.error(`Write at least ${REPLY_MIN} characters before sending.`);
      return;
    }
    setSending(true);
    try {
      const res = await replyToMessage(replying.id, text);
      setMessages((prev) => prev.map((x) => (x.id === res.message.id ? res.message : x)));
      setOpenId(res.message.id);
      setReplying(null);
      if (res.dryRun) {
        toast.success("Reply saved (dry-run mode)", {
          description:
            "Recorded and audited, but no email was sent — add RESEND_API_KEY to the server .env to enable real delivery.",
        });
      } else {
        toast.success("Reply sent", { description: `Delivered to ${res.message.email}.` });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setSending(false);
    }
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMessages(await getAdminMessages());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      unread: messages.filter((m) => m.status === "NEW").length,
      read: messages.filter((m) => m.status === "READ").length,
      archived: messages.filter((m) => m.status === "ARCHIVED").length,
      total: messages.length,
    }),
    [messages]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q) ||
        m.toolName.toLowerCase().includes(q)
      );
    });
  }, [messages, statusFilter, search]);

  const changeStatus = async (m: ContactMessageDTO, status: MessageStatus) => {
    setBusyId(m.id);
    try {
      await setMessageStatus(m.id, status);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, status } : x)));
      if (status === "READ") toast.success("Marked as read");
      if (status === "NEW") toast.success("Marked as unread");
      if (status === "ARCHIVED") toast.success("Message archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  /** Opening a message marks it as read automatically. */
  const toggleOpen = (m: ContactMessageDTO) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    if (m.status === "NEW") void changeStatus(m, "READ");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const m = deleting;
    setBusyId(m.id);
    try {
      await deleteMessage(m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
      setBusyId(null);
    }
  };

  const filterTabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "NEW", label: "Unread", count: stats.unread },
    { value: "READ", label: "Read", count: stats.read },
    { value: "ARCHIVED", label: "Archived", count: stats.archived },
  ];

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading inbox">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => void load()} className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter messages by status">
          {filterTabs.map((t) => (
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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages…"
          aria-label="Search messages"
          className="ml-auto h-9 w-full sm:w-64"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-medium">Inbox is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "Nothing matches your search."
              : "Messages from the contact form will appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => {
            const open = openId === m.id;
            return (
              <li key={m.id}>
                <Card className={cn("py-0 transition-opacity", busyId === m.id && "pointer-events-none opacity-60")}>
                  <CardContent className="p-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => toggleOpen(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleOpen(m);
                        }
                      }}
                      className="flex cursor-pointer flex-col gap-2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {m.status === "NEW" && (
                            <span className="relative flex size-2" aria-label="Unread">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                              <span className="relative inline-flex size-2 rounded-full bg-primary" />
                            </span>
                          )}
                          <h3 className={cn("leading-tight", m.status === "NEW" ? "font-semibold" : "font-medium")}>
                            {m.subject}
                          </h3>
                          {m.repliedAt && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-300/60 font-normal text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300"
                            >
                              <CheckCheck className="size-3" aria-hidden="true" />
                              Replied
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("gap-1 font-normal", REASON_STYLES[m.reason])}>
                            {REASON_ICONS[m.reason]}
                            {CONTACT_REASON_LABELS[m.reason]}
                          </Badge>
                          {m.status === "ARCHIVED" && (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                              <Archive className="size-3" /> Archived
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {m.name} &lt;{m.email}&gt; · {formatDate(m.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 sm:justify-end">
                        {/* Always-rendered slot so the spinner never shifts the
                            actions button horizontally. */}
                        <span
                          className="flex size-4 items-center justify-center"
                          aria-hidden={!busyId || busyId !== m.id}
                        >
                          {busyId === m.id ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working…" />
                          ) : null}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for message from ${m.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                            {m.status !== "READ" && (
                              <DropdownMenuItem onClick={() => void changeStatus(m, "READ")}>
                                <CheckCheck className="size-4" /> Mark as read
                              </DropdownMenuItem>
                            )}
                            {m.status !== "NEW" && (
                              <DropdownMenuItem onClick={() => void changeStatus(m, "NEW")}>
                                <Mail className="size-4" /> Mark as unread
                              </DropdownMenuItem>
                            )}
                            {m.status !== "ARCHIVED" ? (
                              <DropdownMenuItem onClick={() => void changeStatus(m, "ARCHIVED")}>
                                <Archive className="size-4" /> Archive
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void changeStatus(m, "READ")}>
                                <Undo2 className="size-4" /> Unarchive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(m)}>
                              <Trash2 className="size-4" /> Delete…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {open && (
                      <div className="border-t px-4 py-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>

                        {m.reason === "TOOL_SUGGESTION" && (m.toolName || m.toolUrl) && (
                          <div className="mt-4 rounded-lg border border-dashed border-emerald-300/60 bg-emerald-500/5 p-3 dark:border-emerald-700/50">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Suggested tool
                            </p>
                            <p className="mt-1 text-sm font-medium">{m.toolName}</p>
                            {m.toolUrl && (
                              <a
                                href={m.toolUrl}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                              >
                                {m.toolUrl}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                          <Button
                            size="sm"
                            variant={m.repliedAt ? "outline" : "default"}
                            className="h-8"
                            onClick={() => openReply(m)}
                          >
                            <Reply className="size-3.5" aria-hidden="true" />
                            {m.repliedAt ? "Reply again" : "Reply by email"}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Received {formatDate(m.createdAt)} · Status: {m.status.toLowerCase()}
                            {m.repliedAt && ` · Replied ${formatDate(m.repliedAt)}`}
                          </span>
                        </div>

                        {m.repliedAt && m.replyText && (
                          <details className="mt-3 rounded-lg border bg-muted/40 px-3 py-2">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                              Last reply (sent by email)
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                              {m.replyText}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* email reply composer — sent server-side via Resend (never a
          mailto: link, so it also works on machines without a mail client). */}
      <Dialog open={!!replying} onOpenChange={(o) => !o && !sending && setReplying(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden="true" />
              Reply by email
            </DialogTitle>
            <DialogDescription>
              Sent by the server via Resend — from {replying?.name} ({replying?.email}), subject "Re:
              {replying?.subject}". The reply is recorded on the message and audited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="reply-body">Your reply</Label>
            <Textarea
              id="reply-body"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX))}
              placeholder="Write your reply…"
              className="min-h-[160px]"
              aria-describedby="reply-counter"
            />
            <p
              id="reply-counter"
              className={cn(
                "text-right text-xs",
                replyText.trim().length < REPLY_MIN ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {replyText.trim().length} / {REPLY_MAX} characters (min {REPLY_MIN})
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReplying(null)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={() => void sendReply()} disabled={sending || replyText.trim().length < REPLY_MIN}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              From {deleting?.name} — “{deleting?.subject}”. This permanently removes the message
              from the database.
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

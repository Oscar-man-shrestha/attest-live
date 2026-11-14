"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth-context";
import {
  getGroup,
  getGroupMembers,
  removeGroupMember,
  getGroupMessages,
  getSocketUrl,
  ApiError,
} from "@/lib/api";
import {
  GroupResponse,
  GroupMemberResponse,
  GroupMessageResponse,
} from "@embedra/types";

export default function GroupPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const groupId = params?.groupId as string;
  const fallbackIdeaId = searchParams.get("ideaId");

  // ── Group metadata state ──
  const [group, setGroup] = useState<(GroupResponse & { ownerId?: string }) | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Roster state ──
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingMoreMembers, setIsLoadingMoreMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Roster remove contributor state (Phase 1.7) ──
  const [confirmingRemoveUserId, setConfirmingRemoveUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [rosterActionError, setRosterActionError] = useState<string | null>(null);

  // ── Group Chat state (Phase 1.6) ──
  const [messages, setMessages] = useState<GroupMessageResponse[]>([]);
  const [messagesNextCursor, setMessagesNextCursor] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isCurrentUserOwner = !!(user && group && group.ownerId === user.id);

  // ──────────────────────────────────────────────────────────────
  // Fetch group data & verify access
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return;

    if (!token) {
      setAccessDenied(true);
      setIsLoadingGroup(false);
      return;
    }

    if (!groupId) return;

    let isMounted = true;
    async function loadGroupData() {
      try {
        setIsLoadingGroup(true);
        setAccessDenied(false);
        setErrorMessage(null);

        const data = await getGroup(groupId, token!);
        if (isMounted) {
          setGroup(data);
        }
      } catch (err: any) {
        if (isMounted) {
          if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
            setAccessDenied(true);
          } else if (err instanceof ApiError && err.status === 404) {
            setErrorMessage("Formation group not found.");
          } else {
            setAccessDenied(true);
            setErrorMessage(err.message || "Failed to load group");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingGroup(false);
        }
      }
    }

    loadGroupData();
    return () => {
      isMounted = false;
    };
  }, [groupId, token, isAuthLoading]);

  // ──────────────────────────────────────────────────────────────
  // Fetch initial members roster
  // ──────────────────────────────────────────────────────────────
  const loadInitialMembers = useCallback(async () => {
    if (!token || !groupId) return;
    try {
      setIsLoadingMembers(true);
      setMembersError(null);
      const res = await getGroupMembers(groupId, token);
      setMembers(res.members);
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setMembersError(err.message || "Failed to load group roster");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [groupId, token]);

  // Load more roster members
  const loadMoreMembers = async () => {
    if (!token || !groupId || !nextCursor || isLoadingMoreMembers) return;
    try {
      setIsLoadingMoreMembers(true);
      const res = await getGroupMembers(groupId, token, nextCursor);
      setMembers((prev) => [...prev, ...res.members]);
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setMembersError(err.message || "Failed to load more members");
    } finally {
      setIsLoadingMoreMembers(false);
    }
  };

  useEffect(() => {
    if (!accessDenied && group) {
      loadInitialMembers();
    }
  }, [accessDenied, group, loadInitialMembers]);

  // ──────────────────────────────────────────────────────────────
  // Remove contributor handler (Phase 1.7)
  // ──────────────────────────────────────────────────────────────
  const handleInitiateRemove = (userId: string) => {
    setRosterActionError(null);
    setConfirmingRemoveUserId(userId);
  };

  const handleCancelRemove = () => {
    setConfirmingRemoveUserId(null);
  };

  const handleConfirmRemove = async (userId: string) => {
    if (!token || !groupId) return;
    setRemovingUserId(userId);
    setRosterActionError(null);

    try {
      await removeGroupMember(groupId, userId, token);
      // Optimistic update
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setGroup((prev) => (prev ? { ...prev, memberCount: Math.max(1, (prev.memberCount || 1) - 1) } : null));
      setConfirmingRemoveUserId(null);
    } catch (err: any) {
      setRosterActionError(err.message || "Failed to remove contributor from group");
    } finally {
      setRemovingUserId(null);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Load initial chat messages via REST
  // ──────────────────────────────────────────────────────────────
  const loadInitialMessages = useCallback(async () => {
    if (!token || !groupId) return;
    try {
      setIsLoadingMessages(true);
      setChatError(null);
      const res = await getGroupMessages(groupId, token);
      setMessages(res.messages.slice().reverse());
      setMessagesNextCursor(res.nextCursor);
    } catch (err: any) {
      setChatError(err.message || "Failed to load message history");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [groupId, token]);

  // Load older messages via pagination
  const loadOlderMessages = async () => {
    if (!token || !groupId || !messagesNextCursor || isLoadingOlderMessages) return;
    const container = chatScrollContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    try {
      setIsLoadingOlderMessages(true);
      const res = await getGroupMessages(groupId, token, messagesNextCursor);
      const olderMessages = res.messages.slice().reverse();
      setMessages((prev) => [...olderMessages, ...prev]);
      setMessagesNextCursor(res.nextCursor);

      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - previousScrollHeight;
        }
      });
    } catch (err: any) {
      setChatError(err.message || "Failed to load older messages");
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Socket.IO real-time connection
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (accessDenied || !token || !groupId) return;

    loadInitialMessages();

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_group", { groupId }, (ack: any) => {
        if (ack && ack.status === "error") {
          setChatError(ack.message || "Failed to join group channel");
          setAccessDenied(true);
        }
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    socket.on("new_message", (msg: GroupMessageResponse) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("group_error", (err: { message: string }) => {
      setChatError(err.message || "A real-time communication error occurred");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessDenied, token, groupId, loadInitialMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isLoadingOlderMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoadingOlderMessages]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = messageInput.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setChatError(null);

    if (socketRef.current && isConnected) {
      socketRef.current.emit(
        "send_message",
        { groupId, content: text },
        (ack: any) => {
          setIsSending(false);
          if (ack && ack.status === "error") {
            setChatError(ack.message || "Failed to deliver message");
          } else {
            setMessageInput("");
          }
        }
      );
    } else {
      setChatError("Not connected to live cohort server. Reconnecting…");
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Access Denied / Error Screens
  // ──────────────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-error-container/30 border border-error/30 text-error flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">lock</span>
        </div>
        <div className="space-y-1.5">
          <h1 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Access Restricted
          </h1>
          <p className="font-ui-body text-ui-body text-on-surface-variant">
            You must be an accepted collaborator or the hypothesis author to access this formation workspace.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href={fallbackIdeaId ? `/ideas/${fallbackIdeaId}` : "/"}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-ui-medium text-ui-medium rounded-lg shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Return to Hypothesis Spec</span>
          </Link>
        </div>
      </main>
    );
  }

  if (isLoadingGroup) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-6 animate-pulse">
          <div className="h-28 bg-surface-container-lowest rounded-xl border border-outline-variant/30" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <div className="lg:col-span-4 h-96 bg-surface-container-lowest rounded-xl border border-outline-variant/30" />
            <div className="lg:col-span-8 h-96 bg-surface-container-lowest rounded-xl border border-outline-variant/30" />
          </div>
        </div>
      </main>
    );
  }

  const effectiveIdeaId = fallbackIdeaId || (group as any)?.ideaId;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Group Header Block ── */}
      <section className="flex flex-col gap-space-sm bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/20">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          {/* Breadcrumbs & Meta */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-meta-code text-meta-code text-outline text-[12px]">
            <Link href="/" className="hover:text-on-surface transition-colors">Ideas</Link>
            <span>/</span>
            <Link
              href={effectiveIdeaId ? `/ideas/${effectiveIdeaId}` : "#"}
              className="hover:text-on-surface transition-colors max-w-[240px] truncate"
            >
              {group?.ideaTitle || "Hypothesis Spec"}
            </Link>
            <span>/</span>
            <span className="text-primary font-medium bg-surface-container-high px-2 py-0.5 rounded">
              Group #G-{groupId.slice(0, 4)}
            </span>
          </nav>

          {/* Top Action Group */}
          <div className="flex items-center gap-space-xs">
            {effectiveIdeaId && (
              <Link
                href={`/ideas/${effectiveIdeaId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                <span>Idea Specification</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">ios_share</span>
              <span>Copy Link</span>
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg bg-surface-container-low text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Group Settings"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
          </div>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-serif font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Formation Cohort: {group?.ideaTitle || "Collaboration Channel"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-on-secondary-container font-meta-xs text-meta-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                Synchronized
              </span>
            </div>
            <p className="font-serif font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Private working group developing the hypothesis architecture, code implementations, and peer review logs.
            </p>
          </div>

          {/* Cohort Cadence Telemetry */}
          <div className="flex items-center gap-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg shadow-sm border border-outline-variant/10 shrink-0">
            <div className="flex flex-col">
              <span className="font-meta-xs text-meta-xs uppercase tracking-wider text-outline">Sync Target</span>
              <span className="font-meta-code text-meta-code font-semibold text-on-surface text-[12px]">Milestone α-1</span>
            </div>
            <div className="w-px h-6 bg-surface-container-highest"></div>
            <div className="flex flex-col">
              <span className="font-meta-xs text-meta-xs uppercase tracking-wider text-outline">Cadence</span>
              <span className="font-label-sm text-label-sm text-secondary font-medium">Daily async digest</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Two-Section Workspace Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

        {/* ════════════════════════════════════════════════════════
            LEFT COLUMN: Contributor Roster & Cohort Vitals (4 cols)
            ════════════════════════════════════════════════════════ */}
        <aside className="lg:col-span-4 flex flex-col gap-space-md">

          {/* Contributor Roster Card */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
                <h2 className="font-ui-medium text-ui-medium text-on-surface font-semibold">
                  Cohort Roster ({members.length})
                </h2>
              </div>
              <span className="font-meta-code text-meta-code text-outline text-[11px]">
                {group?.memberCount || members.length} Active
              </span>
            </div>

            {rosterActionError && (
              <div className="p-2.5 bg-error-container/30 border border-error/30 rounded-lg text-error text-[11px] font-ui-body">
                {rosterActionError}
              </div>
            )}

            {/* Roster List */}
            <div className="flex flex-col gap-1 divide-y divide-outline-variant/10">
              {isLoadingMembers ? (
                <div className="py-6 text-center text-outline font-meta-xs text-meta-xs">
                  Loading roster…
                </div>
              ) : members.length === 0 ? (
                <div className="py-6 text-center text-outline font-meta-xs text-meta-xs">
                  No contributors recorded yet.
                </div>
              ) : (
                members.map((member) => {
                  const isUserOwner = group?.ownerId ? member.userId === group.ownerId : false;
                  const isSelf = user?.id === member.userId;
                  const isConfirming = confirmingRemoveUserId === member.userId;
                  const isRemoving = removingUserId === member.userId;

                  return (
                    <div
                      key={member.userId}
                      className="flex flex-col py-2 px-1 rounded-lg hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary-container font-bold text-xs flex items-center justify-center shadow-xs">
                              {(member.username || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest" />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                                @{member.username || member.userId.slice(0, 8)}
                              </span>
                              {isSelf && (
                                <span className="font-meta-xs text-meta-xs text-outline font-medium">
                                  (You)
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.2 rounded font-meta-xs text-meta-xs font-semibold text-[10px] ${
                                  isUserOwner
                                    ? "bg-primary-container text-on-primary"
                                    : "bg-surface-container text-outline"
                                }`}
                              >
                                {isUserOwner ? "Owner" : "Contrib"}
                              </span>
                            </div>
                            <span className="font-meta-code text-meta-code text-[11px] text-outline">
                              Joined {new Date(member.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>

                        {/* Owner Remove Contributor Action (Phase 1.7) */}
                        {isCurrentUserOwner && !isUserOwner && !isSelf && (
                          <div className="shrink-0">
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-meta-xs text-meta-xs text-error">Remove?</span>
                                <button
                                  type="button"
                                  disabled={isRemoving}
                                  onClick={() => handleConfirmRemove(member.userId)}
                                  className="px-2 py-0.5 bg-error-container text-on-error-container rounded text-[10px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                                >
                                  {isRemoving ? "…" : "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelRemove}
                                  className="text-outline hover:text-on-surface text-[10px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInitiateRemove(member.userId)}
                                className="px-2 py-1 rounded text-outline hover:text-error hover:bg-error-container/20 font-meta-xs text-meta-xs transition-colors cursor-pointer"
                                title="Remove contributor"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {nextCursor && (
              <button
                type="button"
                onClick={loadMoreMembers}
                disabled={isLoadingMoreMembers}
                className="w-full py-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoadingMoreMembers ? "Loading more…" : "Load More Members"}
              </button>
            )}

            <div className="pt-space-xs flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg text-outline border border-outline-variant/10">
              <div className="flex items-center gap-1.5 font-meta-xs text-meta-xs">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
                <span>Zero-Trust Protocol Active</span>
              </div>
              <span className="font-meta-code text-meta-code text-[10px]">Ed25519</span>
            </div>
          </div>

          {/* Cohort Pinned Artifacts Panel */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/20 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-meta-xs text-meta-xs uppercase tracking-wider text-outline font-semibold">
                Pinned Working Assets
              </span>
              <span className="font-meta-code text-meta-code text-[11px] text-primary">
                Sync v1.0
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">data_object</span>
                  <span className="font-meta-code text-meta-code text-on-surface font-medium text-[12px]">
                    isolate_spec_draft.wasm
                  </span>
                </div>
                <span className="font-meta-xs text-meta-xs text-outline">18.4 KB</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">threat_intelligence</span>
                  <span className="font-meta-code text-meta-code text-on-surface font-medium text-[12px]">
                    threat_matrix_v2.md
                  </span>
                </div>
                <span className="font-meta-xs text-meta-xs text-outline">Updated</span>
              </div>
            </div>
          </div>

          {/* Baseline Telemetry Sparkline Card */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-meta-xs text-meta-xs uppercase tracking-wider text-outline font-semibold">
                Overhead Baseline
              </span>
              <span className="font-meta-code text-meta-code text-secondary text-[11px] font-semibold">
                3.82 MB peak
              </span>
            </div>
            <div className="w-full h-12 flex items-end gap-1 pt-2">
              <div className="flex-1 bg-surface-container-high rounded-t h-[40%]" title="Baseline 1: 1.5MB"></div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[60%]" title="DOM init: 2.2MB"></div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[50%]" title="Wasm load: 1.9MB"></div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[85%]" title="V8 isolate: 3.4MB"></div>
              <div className="flex-1 bg-primary rounded-t h-[95%]" title="Mutation observe: 3.82MB"></div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[70%]" title="Snapshot: 2.8MB"></div>
              <div className="flex-1 bg-surface-container-high rounded-t h-[75%]" title="Garbage collect: 2.9MB"></div>
              <div className="flex-1 bg-secondary rounded-t h-[65%]" title="Steady state: 2.6MB"></div>
            </div>
            <p className="font-meta-xs text-meta-xs text-outline">
              Synthetic telemetry channel active across cohort sockets.
            </p>
          </div>
        </aside>

        {/* ════════════════════════════════════════════════════════
            RIGHT COLUMN: Real-Time Group Chat Card (8 cols)
            ════════════════════════════════════════════════════════ */}
        <section className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 min-h-[640px] h-[calc(100vh-175px)] overflow-hidden">

          {/* Chat Header */}
          <div className="px-space-md py-space-sm border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span
                  className={`w-2.5 h-2.5 rounded-full block ${
                    isConnected ? "bg-secondary animate-pulse" : "bg-outline"
                  }`}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-ui-medium text-ui-medium text-on-surface font-bold">
                  {group?.ideaTitle || "Cohort Stream"}
                </span>
                <span className="font-meta-code text-meta-code text-outline text-[11px]">
                  {isConnected ? "Connected • Real-time Socket.IO" : "Connecting to Socket.IO…"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-meta-xs text-meta-xs text-outline">
              <span className="material-symbols-outlined text-[16px] text-secondary">encrypted</span>
              <span>Encrypted Session</span>
            </div>
          </div>

          {/* Chat Error Banner */}
          {chatError && (
            <div className="p-2 bg-error-container/30 border-b border-error/30 text-error text-[11px] text-center font-ui-body">
              {chatError}
            </div>
          )}

          {/* Chat Stream (Scrollable) */}
          <div
            ref={chatScrollContainerRef}
            className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-md"
            id="chat-stream"
          >
            {messagesNextCursor && (
              <div className="text-center py-1">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={isLoadingOlderMessages}
                  className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-outline hover:text-on-surface text-[11px] font-label-sm rounded-lg transition-colors cursor-pointer"
                >
                  {isLoadingOlderMessages ? "Loading previous messages…" : "Load older messages"}
                </button>
              </div>
            )}

            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full text-outline font-meta-xs text-meta-xs">
                Synchronizing message stream…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-12">
                <span className="material-symbols-outlined text-[36px] text-outline/50">forum</span>
                <p className="font-headline-sm text-headline-sm text-on-surface text-[16px]">
                  Welcome to the Formation Cohort
                </p>
                <p className="font-ui-body text-ui-body text-outline text-[13px] max-w-sm">
                  This synchronous workspace is ready. Send the first message to kick off collaboration.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOutbound = user?.id === msg.userId;

                if (isOutbound) {
                  return (
                    <div key={msg.id} className="flex items-start justify-end gap-3 max-w-[85%] self-end group">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-meta-code text-meta-code text-[11px] text-outline">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="font-label-md text-label-md text-primary font-semibold">
                            {user?.username || "You"} (You)
                          </span>
                        </div>
                        <div className="bg-primary-container text-on-primary p-3 rounded-xl rounded-tr-sm shadow-sm">
                          <p className="font-ui-body text-ui-body whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-outline font-meta-xs text-meta-xs">
                          <span className="material-symbols-outlined text-[13px] text-secondary">done_all</span>
                          <span>Delivered to cohort</span>
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary-container font-bold text-xs flex items-center justify-center mt-0.5 shrink-0 shadow-sm ring-1 ring-primary-container">
                        {(user?.username || "U").charAt(0).toUpperCase()}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex items-start gap-3 max-w-[85%] group">
                    <div className="w-7 h-7 rounded-full bg-surface-container text-on-surface font-bold text-xs flex items-center justify-center mt-0.5 shrink-0 shadow-sm">
                      {(msg.username || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          @{msg.username || msg.userId.slice(0, 8)}
                        </span>
                        <span className="font-meta-code text-meta-code text-[11px] text-outline">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="bg-surface-container-low text-on-surface p-3 rounded-xl rounded-tl-sm shadow-sm">
                        <p className="font-ui-body text-ui-body whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pinned Message Composer Area */}
          <div className="p-space-md bg-surface-container-lowest border-t border-outline-variant/20 flex flex-col gap-2 shrink-0">
            <form
              onSubmit={handleSendMessage}
              className="flex flex-col bg-surface-container-low rounded-xl p-2 focus-within:bg-surface-container-lowest focus-within:shadow-md border border-outline-variant/20 transition-all"
            >
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Message cohort or draft milestone note (⌘ + Enter to send)…"
                className="w-full bg-transparent px-2 py-1 text-on-surface font-ui-body text-ui-body placeholder:text-outline/70 focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/10">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                    title="Attach asset specification"
                  >
                    <span className="material-symbols-outlined text-[18px]">attach_file</span>
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                    title="Insert code or test snippet"
                  >
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                  </button>
                  <span className="h-4 w-px bg-surface-container-highest mx-1"></span>
                  <span className="font-meta-code text-meta-code text-[11px] text-outline px-1">
                    Markdown ready
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-meta-xs text-meta-xs text-outline hidden sm:inline">
                    ⌘ + Enter
                  </span>
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-ui-medium text-ui-medium hover:bg-primary transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isSending ? "Sending…" : "Send"}</span>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

        </section>

      </div>
    </main>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import TeamThread from "@/components/campus/TeamThread";
import {
  addTask,
  checkIn,
  getWork,
  inviteMember,
  leaveTeam,
  removeMember,
  shipIdea,
  taskAction,
  updateTask,
  reassignTask,
  type WorkScreen,
  CampusApiError,
} from "@/lib/campus-api";

type TaskFilter = "all" | "in_progress" | "todo" | "submitted" | "signed";

export default function WorkPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [work, setWork] = useState<WorkScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // New task form state (for author)
  const [newTitle, setNewTitle] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newDescription, setNewDescription] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editLinks, setEditLinks] = useState("");

  // Roster action state
  const [inviteEmail, setInviteEmail] = useState("");
  const [removeUserId, setRemoveUserId] = useState<string>("");
  const [removeReason, setRemoveReason] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // Check-in form state
  const [lines, setLines] = useState({ done: "", stuck: "", next: "" });
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [checkInInitialized, setCheckInInitialized] = useState(false);

  // Task filter
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  const load = () => {
    if (!token || !id) return;
    getWork(token, id)
      .then((data) => {
        setWork(data);
        // Pre-fill check-in if viewer has already submitted
        if (user?.id) {
          const myCheck = data.checkIns.find((c) => c.userId === user.id);
          if (myCheck && !checkInInitialized) {
            setLines({
              done: myCheck.done || "",
              stuck: myCheck.stuck || "",
              next: myCheck.next || "",
            });
            setCheckInInitialized(true);
          }
          if (!newAssignee) {
            setNewAssignee(user.id);
          }
        }
      })
      .catch((err) =>
        setError(err instanceof CampusApiError ? err.message : "Could not open the workspace")
      );
  };

  useEffect(() => {
    load();
    // Reload only when the route or session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, user?.id]);

  // Derived state
  const activeRoster = useMemo(
    () => work?.roster.filter((m) => !m.leftAt) || [],
    [work?.roster]
  );

  const viewerCheckIn = useMemo(
    () => work?.checkIns.find((c) => c.userId === user?.id),
    [work?.checkIns, user?.id]
  );

  const isPastDay7 = useMemo(() => {
    if (!work?.day7) return false;
    return new Date() >= new Date(work.day7);
  }, [work?.day7]);

  const isViewerReopened = useMemo(() => {
    if (!user?.id || !work?.reopenedUserIds) return false;
    return work.reopenedUserIds.includes(user.id);
  }, [user?.id, work?.reopenedUserIds]);

  // Viewer's active / next task
  const myTasks = useMemo(
    () => (work?.tasks || []).filter((t) => t.assigneeId === user?.id),
    [work?.tasks, user?.id]
  );

  const viewerNextTask = useMemo(() => {
    if (!myTasks.length) return null;
    return (
      myTasks.find((t) => t.status === "in_progress") ||
      myTasks.find((t) => t.status === "todo") ||
      myTasks.find((t) => t.status === "submitted") ||
      null
    );
  }, [myTasks]);

  // Teammates who are stuck
  const stuckTeammates = useMemo(() => {
    if (!work?.checkIns) return [];
    return work.checkIns
      .filter((c) => {
        const raw = c.stuck?.trim().toLowerCase() || "";
        const s = raw.replace(/^[•\-\*,\s]+|[.,!?-]+$/g, "");
        if (s.length < 3) return false;
        const benignExact = ["none", "no", "nothing", "nil", "n/a", "na", "-", "nope", "all good", "no blockers", "none so far", "not stuck", "none right now", "no blocker"];
        if (benignExact.includes(s)) return false;
        if (/^(none|no blockers?|not stuck|nothing|all good)\b/i.test(s)) return false;
        return true;
      })
      .map((c) => {
        const member = work.roster.find((m) => m.userId === c.userId);
        return {
          userId: c.userId,
          name: member?.name || "Teammate",
          role: member?.role || "Collaborator",
          stuck: c.stuck,
          next: c.next,
          done: c.done,
          isViewer: c.userId === user?.id,
        };
      });
  }, [work?.checkIns, work?.roster, user?.id]);

  // Filtered task list
  const filteredTasks = useMemo(() => {
    if (!work?.tasks) return [];
    if (taskFilter === "all") return work.tasks;
    if (taskFilter === "in_progress") return work.tasks.filter((t) => t.status === "in_progress");
    if (taskFilter === "todo") return work.tasks.filter((t) => t.status === "todo");
    if (taskFilter === "submitted") return work.tasks.filter((t) => t.status === "submitted");
    if (taskFilter === "signed")
      return work.tasks.filter((t) => t.receiptStatus === "signed" || t.status === "done");
    return work.tasks;
  }, [work?.tasks, taskFilter]);

  if (!work) {
    return (
      <div className="px-5 py-12 max-w-4xl xl:max-w-6xl mx-auto text-center space-y-3">
        <p className="text-[15px] text-[#777587]">{error || "Loading workspace…"}</p>
        {error && (
          <Link href="/ideas" className="inline-block text-[13px] text-[#4f46e5] font-semibold hover:underline">
            ← Back to Ideas
          </Link>
        )}
      </div>
    );
  }

  const nameOf = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const found = work.roster.find((r) => r.userId === userId);
    return found ? found.name : "Teammate";
  };

  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;
    if (!lines.done.trim() || !lines.stuck.trim() || !lines.next.trim()) {
      setError("Please fill in Done, Stuck, and Next lines.");
      return;
    }
    setSavingCheckIn(true);
    setError(null);
    try {
      await checkIn(token, id, lines);
      setNotice("Check-in saved successfully!");
      setTimeout(() => setNotice(null), 4000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to save check-in");
    } finally {
      setSavingCheckIn(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !newTitle.trim()) return;
    setBusyAction("add_task");
    setError(null);
    try {
      await addTask(token, id, {
        title: newTitle.trim(),
        role: newRole.trim() || undefined,
        description: newDescription.trim() || undefined,
        assigneeId: newAssignee || user?.id,
      });
      setNewTitle("");
      setNewRole("");
      setNewDescription("");
      setShowAddTask(false);
      setNotice("Task added to board");
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to add task");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveTaskDraft = async (taskId: string) => {
    if (!token) return;
    setBusyAction(`draft_${taskId}`);
    setError(null);
    try {
      const linkArr = editLinks
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("http"));
      await updateTask(token, taskId, editNotes, linkArr);
      setEditingTaskId(null);
      setNotice("Task draft notes saved");
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to update draft");
    } finally {
      setBusyAction(null);
    }
  };

  const handleTaskAction = async (taskId: string, action: "start" | "submit" | "sign" | "dispute") => {
    if (!token) return;
    setBusyAction(`${action}_${taskId}`);
    setError(null);
    try {
      await taskAction(token, taskId, action);
      const messages: Record<string, string> = {
        start: "Task started",
        submit: "Task submitted and frozen. A teammate can now sign as witness.",
        sign: "Proof receipt signed as witness!",
        dispute: "Receipt disputed",
      };
      setNotice(messages[action] || "Task updated");
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : `Failed to ${action} task`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReassign = async (taskId: string, newAssigneeId: string) => {
    if (!token) return;
    setBusyAction(`reassign_${taskId}`);
    setError(null);
    try {
      await reassignTask(token, taskId, newAssigneeId === "" ? null : newAssigneeId);
      setNotice("Task assignee updated");
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to reassign task");
    } finally {
      setBusyAction(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !inviteEmail.trim()) return;
    setBusyAction("invite");
    setError(null);
    try {
      await inviteMember(token, id, inviteEmail.trim());
      setInviteEmail("");
      setShowInviteModal(false);
      setNotice("Invite sent! The student must accept from their inbox.");
      setTimeout(() => setNotice(null), 4000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to send invite");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !removeUserId) return;
    setBusyAction("remove");
    setError(null);
    try {
      await removeMember(token, id, removeUserId, removeReason.trim() || "Author removed teammate");
      setRemoveUserId("");
      setRemoveReason("");
      setShowRemoveModal(false);
      setNotice("Teammate removed. Their submitted and signed tasks stay frozen.");
      setTimeout(() => setNotice(null), 4000);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to remove member");
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeave = async () => {
    if (!token || !id) return;
    if (!confirm("Are you sure you want to leave this sprint team? Your submitted tasks will remain frozen.")) return;
    setBusyAction("leave");
    try {
      await leaveTeam(token, id);
      setNotice("You left the sprint team.");
      setTimeout(() => {
        window.location.href = "/ideas";
      }, 1500);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to leave team");
      setBusyAction(null);
    }
  };

  const handleShip = async () => {
    if (!token || !id) return;
    if (!confirm("Ready to ship? This marks the sprint as completed and ready for proof publishing.")) return;
    setBusyAction("ship");
    try {
      await shipIdea(token, id);
      setNotice("🎉 Sprint marked as shipped! You can now publish your proof page.");
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Failed to ship idea");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl xl:max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4">
        <div>
          <Link
            href={`/ideas/${id}`}
            className="text-[12px] font-semibold text-[#4f46e5] hover:underline flex items-center gap-1"
          >
            ← View Idea Detail
          </Link>
          <h1 className="font-serif text-[28px] sm:text-[32px] font-semibold text-[#141b2b] mt-1">
            {work.idea.title}
          </h1>
          {work.idea.ships && (
            <p className="text-[13px] text-[#464555] max-w-2xl mt-0.5">
              Goal: {work.idea.ships}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#eef0ff] text-[#3730a3] capitalize">
            {work.idea.teamStatus === "shipped" ? "🚢 Shipped" : `🔨 ${work.idea.stage || "Building"}`}
          </span>
          {work.isAuthor && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#141b2b] text-white">
              Author
            </span>
          )}
        </div>
      </div>

      {/* Global Notice & Error Banners */}
      {notice && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[13px] text-[#166534] flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[#166534] font-semibold ml-2">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#ffdad6] bg-[#fff8f6] p-3 text-[13px] text-[#ba1a1a] flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[#ba1a1a] font-semibold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Confidential Approach Callout */}
      {work.approach && (
        <div className="rounded-xl border border-[#c7c4d8] bg-[#f1f3ff] p-4 text-[13px] text-[#141b2b] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[12px] uppercase tracking-wider text-[#3730a3]">
              Private Team Blueprint
            </span>
            <span className="text-[11px] text-[#777587]">Confidential to accepted teammates</span>
          </div>
          <p className="whitespace-pre-wrap text-[#464555] pt-1">{work.approach.body}</p>
        </div>
      )}

      {/* Day-7 Check-in Nudge Banner */}
      {isPastDay7 && !viewerCheckIn && (
        <div className="rounded-xl border-2 border-[#ba1a1a] bg-[#fff5f5] p-4 text-[#141b2b] shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ba1a1a] text-white text-[16px]">
              ⚠️
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[15px] text-[#ba1a1a]">
                  Day 7 Check-in Required (Mid-Sprint Milestone)
                </p>
                <span className="rounded bg-[#ffebeb] px-2 py-0.5 text-[11px] font-semibold text-[#ba1a1a] border border-[#f5c2c0]">
                  Immediate Action
                </span>
              </div>
              <p className="text-[13px] text-[#464555]">
                The sprint has passed Day 7. Submit your done, stuck, and next lines below to keep your seat active. Unchecked roles are reopened to the campus community.
              </p>
              <div className="pt-2">
                <a
                  href="#checkin-form"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ba1a1a] text-white text-[13px] font-semibold hover:bg-[#93000a] transition-colors"
                >
                  Fill Check-In Now ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPastDay7 && viewerCheckIn && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[13px] text-[#166534] flex items-center justify-between">
          <span>✓ Your Day-7 check-in is logged. Teammates can see what you completed and where you need help.</span>
          <a href="#checkin-form" className="text-[12px] font-semibold text-[#166534] hover:underline ml-2">
            Update Lines ↓
          </a>
        </div>
      )}

      {isViewerReopened && (
        <div className="rounded-xl border border-[#f5c2c0] bg-[#fff8f7] p-3 text-[13px] text-[#ba1a1a]">
          ⚠️ {work.isAuthor
            ? "Your check-in is pending. Submit your done, stuck, and next lines below so teammates know where the sprint stands."
            : "Your seat was marked as reopened because the Day-7 check-in was missed. You can still save your check-in below to update your status."}
        </div>
      )}

      {/* HERO SECTION: Next Task for Viewer */}
      <section className="rounded-2xl border-2 border-[#4f46e5] bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4f46e5] text-white text-[12px] font-bold">
              ⚡
            </span>
            <h2 className="font-semibold text-[15px] text-[#141b2b]">Your Next Task</h2>
          </div>
          {viewerNextTask && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                viewerNextTask.status === "in_progress"
                  ? "bg-[#eef0ff] text-[#4f46e5] border border-[#c7c4d8]"
                  : viewerNextTask.status === "submitted"
                  ? "bg-[#fef9c3] text-[#854d0e] border border-[#fef08a]"
                  : "bg-[#f1f3ff] text-[#464555]"
              }`}
            >
              {viewerNextTask.status === "in_progress"
                ? "Active In Progress"
                : viewerNextTask.status === "submitted"
                ? "Submitted · Awaiting Witness"
                : "Next Up"}
            </span>
          )}
        </div>

        {viewerNextTask ? (
          <div className="bg-[#fafaff] rounded-xl border border-[#e4e2ee] p-4 space-y-3">
            <div>
              <p className="font-semibold text-[16px] text-[#141b2b]">{viewerNextTask.title}</p>
              {viewerNextTask.role && (
                <span className="inline-block mt-1 text-[11px] font-medium text-[#4f46e5] bg-white px-2 py-0.5 rounded border border-[#e4e2ee]">
                  Role: {viewerNextTask.role}
                </span>
              )}
              {viewerNextTask.description ? (
                <p className="text-[13px] text-[#464555] mt-2 whitespace-pre-wrap">
                  {viewerNextTask.description}
                </p>
              ) : (
                <p className="text-[12px] text-[#777587] mt-1 italic">No detailed description yet.</p>
              )}
            </div>

            {/* Quick Actions for Next Task */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#e4e2ee]">
              {viewerNextTask.status === "todo" && (
                <button
                  type="button"
                  disabled={busyAction === `start_${viewerNextTask.id}`}
                  onClick={() => handleTaskAction(viewerNextTask.id, "start")}
                  className="px-3.5 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] transition-colors"
                >
                  {busyAction === `start_${viewerNextTask.id}` ? "Starting…" : "Start This Task"}
                </button>
              )}

              {viewerNextTask.status === "in_progress" && (
                <>
                  <button
                    type="button"
                    disabled={busyAction === `submit_${viewerNextTask.id}`}
                    onClick={() => handleTaskAction(viewerNextTask.id, "submit")}
                    className="px-3.5 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] transition-colors"
                  >
                    {busyAction === `submit_${viewerNextTask.id}` ? "Submitting…" : "Submit & Freeze for Witness"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(viewerNextTask.id);
                      setEditNotes(viewerNextTask.description || "");
                      setEditLinks((viewerNextTask.links || []).join("\n"));
                    }}
                    className="px-3 py-2 rounded-lg border border-[#c7c4d8] text-[13px] text-[#464555] hover:bg-white"
                  >
                    Edit Draft Notes & Links
                  </button>
                </>
              )}

              {viewerNextTask.status === "submitted" && (
                <p className="text-[12px] text-[#854d0e] font-medium">
                  ✓ Submitted! A teammate must sign as witness below to seal your proof receipt.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-5 bg-[#fafaff] rounded-xl border border-dashed border-[#c7c4d8] space-y-2">
            <p className="text-[14px] text-[#464555] font-medium">You don't have an active task right now.</p>
            <p className="text-[12px] text-[#777587]">
              {work.isAuthor
                ? "Start the sprint by creating a small first task. Assign it to yourself or a teammate, then agree on what can be shown in two weeks."
                : "Check the task list below or ask the idea author to assign your first task."}
            </p>
            {work.isAuthor && (
              <button
                type="button"
                onClick={() => {
                  setShowAddTask(true);
                  setNewAssignee(user?.id || "");
                }}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold"
              >
                + Create First Task
              </button>
            )}
          </div>
        )}
      </section>

      {/* SECTION: Who is Stuck (from check-ins) */}
      <section className="rounded-2xl border border-[#fed7aa] bg-[#fffdfa] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316] text-white text-[12px] font-bold">
              ?
            </span>
            <h2 className="font-semibold text-[15px] text-[#141b2b]">
              Blockers & Who is Stuck ({stuckTeammates.length})
            </h2>
          </div>
          <span className="text-[11px] text-[#777587]">Updated from sprint check-ins</span>
        </div>

        {stuckTeammates.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {stuckTeammates.map((item) => (
              <div
                key={item.userId}
                className="rounded-xl border border-[#fed7aa] bg-white p-3.5 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-[#141b2b]">
                    {item.name} {item.isViewer && "(You)"}
                  </span>
                  <span className="text-[11px] font-medium text-[#c2410c] bg-[#fff7ed] px-2 py-0.5 rounded border border-[#ffedd5]">
                    {item.role}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ea580c]">
                    Current Blocker:
                  </p>
                  <p className="text-[13px] text-[#141b2b] mt-0.5 bg-[#fff8f5] p-2 rounded-lg border border-[#ffe4d6]">
                    "{item.stuck}"
                  </p>
                </div>
                {item.next && (
                  <p className="text-[12px] text-[#777587]">
                    <span className="font-medium text-[#464555]">Next plan:</span> {item.next}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-[#e5e7eb] p-3 text-[13px] text-[#166534] flex items-center gap-2">
            <span>✓</span>
            <span>No active blockers reported. All teammates are moving forward.</span>
          </div>
        )}
      </section>

      {/* SECTION: Prominent Check-In Form */}
      <section
        id="checkin-form"
        className="rounded-2xl border border-[#c7c4d8] bg-white p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141b2b] text-white text-[12px] font-bold">
                ✓
              </span>
              <h2 className="font-semibold text-[16px] text-[#141b2b]">Sprint Check-In</h2>
            </div>
            <p className="text-[12px] text-[#777587] mt-0.5">
              Write 3 lines (Done, Stuck, Next). Keeps your role active and unblocks teammates.
            </p>
          </div>
          {viewerCheckIn ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
              ✓ Check-in Logged
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#fff1f1] text-[#ba1a1a] border border-[#f5c2c0]">
              ⚠️ Check-in Due
            </span>
          )}
        </div>

        <form onSubmit={handleSaveCheckIn} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-[12px] font-semibold text-[#141b2b]">
              1. What have you completed recently? (Done)
            </label>
            <input
              value={lines.done}
              onChange={(e) => setLines({ ...lines, done: e.target.value })}
              placeholder="e.g. Built the auth API endpoints and tested with Supabase"
              className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-semibold text-[#141b2b]">
              2. What is blocking you or what help do you need? (Stuck)
            </label>
            <input
              value={lines.stuck}
              onChange={(e) => setLines({ ...lines, stuck: e.target.value })}
              placeholder="e.g. Waiting on API spec for comments, or 'None'"
              className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-semibold text-[#141b2b]">
              3. What will you ship or work on next? (Next)
            </label>
            <input
              value={lines.next}
              onChange={(e) => setLines({ ...lines, next: e.target.value })}
              placeholder="e.g. Building the proof receipt review UI and linking backend"
              className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={savingCheckIn}
              className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] disabled:opacity-50 transition-colors"
            >
              {savingCheckIn ? "Saving Check-In…" : viewerCheckIn ? "Update Check-In" : "Submit Check-In"}
            </button>
          </div>
        </form>

        {/* Teammates check-in log */}
        {work.checkIns.length > 0 && (
          <div className="pt-3 border-t border-[#e5e7eb] space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">
              Team Check-In History ({work.checkIns.length})
            </p>
            <div className="space-y-2">
              {work.checkIns.map((row) => {
                const member = work.roster.find((m) => m.userId === row.userId);
                return (
                  <div key={row.userId} className="rounded-xl border border-[#e4e2ee] bg-[#fafaff] p-3 text-[13px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#141b2b]">
                        {member?.name || "Teammate"} {row.userId === user?.id && "(You)"}
                      </span>
                      <span className="text-[11px] text-[#777587] capitalize">{member?.role || "Collaborator"}</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 pt-1 text-[12px]">
                      <div>
                        <span className="font-medium text-[#166534]">Done:</span>{" "}
                        <span className="text-[#464555]">{row.done}</span>
                      </div>
                      <div>
                        <span className="font-medium text-[#c2410c]">Stuck:</span>{" "}
                        <span className="text-[#464555]">{row.stuck}</span>
                      </div>
                      <div>
                        <span className="font-medium text-[#4f46e5]">Next:</span>{" "}
                        <span className="text-[#464555]">{row.next}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION: Clear Team Roster */}
      <section className="rounded-2xl border border-[#c7c4d8] bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141b2b] text-white text-[12px] font-bold">
                👥
              </span>
              <h2 className="font-semibold text-[16px] text-[#141b2b]">
                Team Roster ({activeRoster.length} of {work.idea.teamMax ?? 6} seats)
              </h2>
            </div>
            <p className="text-[12px] text-[#777587] mt-0.5">
              1 Author + up to {(work.idea.teamMax ?? 6) - 1} Collaborators. Tasks and signed receipts belong to this team.
            </p>
          </div>

          {work.isAuthor && activeRoster.length < 4 && (
            <button
              type="button"
              onClick={() => setShowInviteModal(!showInviteModal)}
              className="px-3 py-1.5 rounded-lg border border-[#c7c4d8] text-[12px] font-semibold text-[#4f46e5] hover:bg-[#f1f3ff]"
            >
              + Invite Collaborator
            </button>
          )}
        </div>

        {/* Invite Form Accordion */}
        {showInviteModal && work.isAuthor && (
          <form onSubmit={handleInvite} className="bg-[#f1f3ff] rounded-xl p-3.5 space-y-2 border border-[#c7c4d8]">
            <p className="font-semibold text-[13px] text-[#141b2b]">Invite a classmate to join this sprint</p>
            <div className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@university.edu"
                className="flex-1 rounded-lg border border-[#c7c4d8] px-3 py-1.5 text-[13px] bg-white"
              />
              <button
                type="submit"
                disabled={busyAction === "invite"}
                className="px-4 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] disabled:opacity-50"
              >
                {busyAction === "invite" ? "Sending…" : "Send Invite"}
              </button>
            </div>
            <p className="text-[11px] text-[#777587]">
              The invite will appear in their Attest Inbox. They must accept before taking a seat.
            </p>
          </form>
        )}

        {/* Roster Cards */}
        <div className="grid sm:grid-cols-2 gap-3">
          {work.roster.map((member) => {
            const hasCheckedIn = work.checkIns.some((c) => c.userId === member.userId);
            const isReopened = work.reopenedUserIds.includes(member.userId);
            const memberTasks = work.tasks.filter((t) => t.assigneeId === member.userId);
            const signedTasks = memberTasks.filter((t) => t.receiptStatus === "signed");

            return (
              <div
                key={member.userId}
                className={`rounded-xl border p-4 space-y-2.5 transition-colors ${
                  member.leftAt
                    ? "border-[#e5e7eb] bg-[#f9fafb] opacity-60"
                    : "border-[#e4e2ee] bg-white shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[15px] text-[#141b2b]">
                      {member.name} {member.userId === user?.id && <span className="text-[#4f46e5] text-[12px] font-normal">(You)</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          member.role === "author"
                            ? "bg-[#141b2b] text-white"
                            : "bg-[#eef0ff] text-[#3730a3]"
                        }`}
                      >
                        {member.role === "author" ? "Author" : "Collaborator"}
                      </span>
                      {member.leftAt && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#fee2e2] text-[#991b1b]">
                          Left ({member.exitReason || "left"})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {hasCheckedIn ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                        ✓ Checked in
                      </span>
                    ) : isPastDay7 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fff1f1] text-[#ba1a1a] border border-[#f5c2c0]">
                        ⚠️ Missed check-in
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] text-[#777587]">
                        Pending check-in
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] text-[#777587] pt-1 border-t border-[#f1f3ff]">
                  <span>
                    Tasks: {memberTasks.length} ({signedTasks.length} signed)
                  </span>
                  {isReopened && !member.leftAt && (
                    <span className="text-[#ba1a1a] font-medium">Role reopened</span>
                  )}
                </div>
                {work.isAuthor && member.role === "collaborator" && !member.leftAt && (
                  <Link
                    href={`/deals/new?ideaId=${encodeURIComponent(work.idea.id)}&builderId=${encodeURIComponent(member.userId)}`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#047857] hover:underline"
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden>handshake</span>
                    Propose a deal with {member.name.split(" ")[0] || "this builder"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Member Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e5e7eb]">
          {work.isAuthor && activeRoster.some((m) => m.role === "collaborator") && (
            <button
              type="button"
              onClick={() => setShowRemoveModal(!showRemoveModal)}
              className="text-[12px] text-[#777587] hover:text-[#ba1a1a]"
            >
              Manage / Remove a collaborator
            </button>
          )}

          {!work.isAuthor && (
            <button
              type="button"
              onClick={handleLeave}
              disabled={busyAction === "leave"}
              className="text-[12px] text-[#ba1a1a] hover:underline"
            >
              {busyAction === "leave" ? "Leaving…" : "Leave this team"}
            </button>
          )}
        </div>

        {/* Remove Teammate Modal */}
        {showRemoveModal && work.isAuthor && (
          <form onSubmit={handleRemove} className="bg-[#fff8f7] rounded-xl p-4 space-y-3 border border-[#f5c2c0]">
            <p className="font-semibold text-[13px] text-[#ba1a1a]">Remove a collaborator from team</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <select
                value={removeUserId}
                onChange={(e) => setRemoveUserId(e.target.value)}
                className="rounded-lg border border-[#c7c4d8] px-3 py-1.5 text-[13px] bg-white"
                required
              >
                <option value="">Select collaborator…</option>
                {activeRoster
                  .filter((m) => m.role === "collaborator")
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <input
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Reason for removal"
                className="rounded-lg border border-[#c7c4d8] px-3 py-1.5 text-[13px] bg-white"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyAction === "remove" || !removeUserId}
                className="px-3 py-1.5 rounded-lg bg-[#ba1a1a] text-white text-[12px] font-semibold disabled:opacity-50"
              >
                {busyAction === "remove" ? "Removing…" : "Confirm Removal"}
              </button>
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-3 py-1.5 rounded-lg border text-[12px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* SECTION: Team thread (owner + active teammates only) */}
      {token && <TeamThread token={token} ideaId={work.idea.id} />}

      {/* SECTION: Task Board & List Status */}
      <section className="rounded-2xl border border-[#c7c4d8] bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141b2b] text-white text-[12px] font-bold">
                📋
              </span>
              <h2 className="font-semibold text-[16px] text-[#141b2b]">
                Sprint Tasks ({work.tasks.length})
              </h2>
            </div>
            <p className="text-[12px] text-[#777587] mt-0.5">
              Tasks establish the work record. Submitting freezes notes; teammates witness and sign to mint proof.
            </p>
          </div>

          {work.isAuthor && (
            <button
              type="button"
              onClick={() => setShowAddTask(!showAddTask)}
              className="px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold hover:bg-[#4338ca] transition-colors"
            >
              {showAddTask ? "Cancel" : "+ Add Task"}
            </button>
          )}
        </div>

        {/* Author Add Task Form */}
        {showAddTask && work.isAuthor && (
          <form onSubmit={handleCreateTask} className="bg-[#fafaff] rounded-xl p-4 space-y-3 border border-[#c7c4d8]">
            <p className="font-semibold text-[14px] text-[#141b2b]">Create new sprint task</p>
            <div className="grid sm:grid-cols-[2fr_1fr_1fr] gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title (e.g. Implement login flow)"
                className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white"
                required
              />
              <input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Role tag (e.g. Backend)"
                className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white"
              />
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white"
              >
                {activeRoster.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} {m.userId === user?.id && "(You)"}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Task details, requirements, or links"
              rows={2}
              className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyAction === "add_task"}
                className="px-4 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] disabled:opacity-50"
              >
                {busyAction === "add_task" ? "Adding…" : "Add Task"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-3 py-1.5 rounded-lg border text-[13px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Task Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 text-[12px] border-b border-[#f1f3ff] pb-2">
          {(
            [
              { id: "all", label: `All (${work.tasks.length})` },
              { id: "in_progress", label: `In Progress (${work.tasks.filter((t) => t.status === "in_progress").length})` },
              { id: "todo", label: `To Do (${work.tasks.filter((t) => t.status === "todo").length})` },
              { id: "submitted", label: `Needs Signature (${work.tasks.filter((t) => t.status === "submitted").length})` },
              { id: "signed", label: `Signed Proof (${work.tasks.filter((t) => t.receiptStatus === "signed" || t.status === "done").length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTaskFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                taskFilter === tab.id
                  ? "bg-[#141b2b] text-white"
                  : "bg-[#f1f3ff] text-[#464555] hover:bg-[#e4e2ee]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task Cards List */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isAssignee = task.assigneeId === user?.id;
              const isEditing = editingTaskId === task.id;

              return (
                <article
                  key={task.id}
                  className="rounded-xl border border-[#e4e2ee] bg-white p-4 space-y-3 shadow-xs hover:border-[#c7c4d8] transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[15px] text-[#141b2b]">{task.title}</p>
                        {task.role && (
                          <span className="text-[11px] font-medium bg-[#eef0ff] text-[#3730a3] px-2 py-0.5 rounded">
                            {task.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#777587] flex items-center gap-1.5 flex-wrap">
                        <span>Assignee:</span>
                        {work.isAuthor && !task.frozenAt && task.status !== "submitted" && task.status !== "done" ? (
                          <select
                            value={task.assigneeId || ""}
                            disabled={busyAction === `reassign_${task.id}`}
                            onChange={(e) => handleReassign(task.id, e.target.value)}
                            className="text-[12px] py-0.5 px-1.5 border border-[#c7c4d8] rounded bg-white text-[#141b2b] font-medium focus:outline-none focus:border-[#4f46e5]"
                          >
                            <option value="">(Unassigned)</option>
                            <option value={work.idea.ownerId ?? ""}>{nameOf(work.idea.ownerId ?? "")} (Author)</option>
                            {work.roster
                              .filter((m) => !m.leftAt && m.userId !== work.idea.ownerId)
                              .map((c) => (
                                <option key={c.userId} value={c.userId}>
                                  {c.name || nameOf(c.userId)} {c.role ? `(${c.role})` : ""}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="font-medium text-[#464555]">{nameOf(task.assigneeId)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                          task.status === "in_progress"
                            ? "bg-[#eef0ff] text-[#4f46e5]"
                            : task.status === "submitted"
                            ? "bg-[#fef9c3] text-[#854d0e]"
                            : task.status === "done"
                            ? "bg-[#f0fdf4] text-[#166534]"
                            : "bg-[#f1f3ff] text-[#464555]"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                      {task.receiptStatus && (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                            task.receiptStatus === "signed"
                              ? "bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]"
                              : "bg-[#f1f3ff] text-[#777587]"
                          }`}
                        >
                          {task.receiptStatus === "signed" ? "✓ Signed Proof" : task.receiptStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Notes / Description */}
                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t border-[#e4e2ee]">
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Draft notes, summary of work done"
                        rows={3}
                        className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px]"
                      />
                      <textarea
                        value={editLinks}
                        onChange={(e) => setEditLinks(e.target.value)}
                        placeholder="Links (one per line, e.g. GitHub PR or commit URL)"
                        rows={2}
                        className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveTaskDraft(task.id)}
                          disabled={busyAction === `draft_${task.id}`}
                          className="px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold"
                        >
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="px-3 py-1.5 rounded-lg border text-[12px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {task.description && (
                        <p className="text-[13px] text-[#464555] whitespace-pre-wrap">{task.description}</p>
                      )}
                      {task.links && task.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {task.links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12px] text-[#4f46e5] underline hover:text-[#4338ca] inline-flex items-center gap-1"
                            >
                              🔗 Link {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Task Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f1f3ff]">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Assignee Actions */}
                      {isAssignee && !task.frozenAt && task.status === "todo" && (
                        <button
                          type="button"
                          disabled={busyAction === `start_${task.id}`}
                          onClick={() => handleTaskAction(task.id, "start")}
                          className="px-2.5 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold hover:bg-[#4338ca]"
                        >
                          Start Task
                        </button>
                      )}

                      {isAssignee && !task.frozenAt && task.status === "in_progress" && (
                        <>
                          <button
                            type="button"
                            disabled={busyAction === `submit_${task.id}`}
                            onClick={() => handleTaskAction(task.id, "submit")}
                            className="px-2.5 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold hover:bg-[#4338ca]"
                          >
                            Submit & Freeze
                          </button>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditNotes(task.description || "");
                                setEditLinks((task.links || []).join("\n"));
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-[#c7c4d8] text-[12px] text-[#464555] hover:bg-[#f1f3ff]"
                            >
                              Edit Draft
                            </button>
                          )}
                        </>
                      )}

                      {/* Teammate Witness Action */}
                      {!isAssignee && task.status === "submitted" && (
                        <button
                          type="button"
                          disabled={busyAction === `sign_${task.id}`}
                          onClick={() => handleTaskAction(task.id, "sign")}
                          className="px-3 py-1.5 rounded-lg bg-[#166534] text-white text-[12px] font-semibold hover:bg-[#14532d]"
                        >
                          Sign as Witness
                        </button>
                      )}

                      {/* Author Dispute Action */}
                      {work.isAuthor && task.receiptStatus === "signed" && (
                        <button
                          type="button"
                          disabled={busyAction === `dispute_${task.id}`}
                          onClick={() => handleTaskAction(task.id, "dispute")}
                          className="text-[12px] text-[#777587] hover:text-[#ba1a1a]"
                        >
                          Dispute receipt
                        </button>
                      )}
                    </div>

                    {task.frozenAt && (
                      <span className="text-[11px] text-[#777587]">
                        Frozen {new Date(task.frozenAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-[#fafaff] rounded-xl border border-dashed border-[#c7c4d8]">
            <p className="text-[13px] text-[#777587]">No tasks found in this view.</p>
          </div>
        )}
      </section>

      {/* SECTION: Author Ship Action */}
      {work.isAuthor && work.idea.teamStatus !== "shipped" && (
        <section className="rounded-2xl border border-[#c7c4d8] bg-[#f9f9ff] p-5 text-center space-y-3">
          <h2 className="font-serif text-[20px] font-semibold text-[#141b2b]">
            Ready to Complete Sprint?
          </h2>
          <p className="text-[13px] text-[#464555] max-w-md mx-auto">
            Marking this idea as shipped closes new tasks and allows all active teammates to feature signed proof on their public profile.
          </p>
          <button
            type="button"
            onClick={handleShip}
            disabled={busyAction === "ship"}
            className="px-5 py-2.5 rounded-xl bg-[#141b2b] text-white text-[13px] font-semibold hover:bg-black disabled:opacity-50 transition-colors"
          >
            {busyAction === "ship" ? "Marking Shipped…" : "Mark Sprint as Shipped"}
          </button>
        </section>
      )}
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

export class CampusApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CampusApiError(data.error || "Request failed", response.status, data.details);
  return data as T;
}

export type SprintIdea = {
  id: string;
  title: string;
  visibility?: "minimal" | "standard" | "open";
  blurb?: string | null;
  pitch: string | null;
  audience: string | null;
  gap: string | null;
  ships: string | null;
  briefLocked?: boolean;
  stage: string;
  teamStatus: string;
  helpNeeded: string[];
  isSmall: boolean;
  hourCap: number | null;
  compensationSentence: string | null;
  hideName: boolean;
  authorName: string;
  authorBranch: string | null;
  authorSemester: number | null;
  problemId: string | null;
  problemTitle: string | null;
  duplicateOfId: string | null;
  forkedFromId?: string | null;
  forkCount?: number;
  createdAt: string;
  ownerId: string | null;
  problemSource?: { id: string; title: string; reporterName: string | null } | null;
  hidden: boolean;
  saved: boolean;
  seatsOpen?: boolean;
  collaboratorCount?: number;
  publishedAt?: string;
  approach?: { body: string; contactEmail?: string } | null;
  isMember?: boolean;
  engagement?: Engagement;
  teamMax?: number;
  campusOnly?: boolean;
  sameCampus?: boolean;
  dealType?: string;
  currency?: string | null;
  budgetMinor?: number | null;
  licence?: string | null;
  images?: { id: string; imageUrl: string; role: "hero" | "figure" }[];
};

export type Engagement = { likes: number; liked: boolean; comments: number; shares: number; wants?: number; wanted?: boolean; campusWants?: number };

export type SprintComment = {
  id: string;
  parentId: string | null;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  author: { id: string | null; name: string; branch: string | null; semester: number | null; headline: string | null; isIdeaAuthor: boolean };
  likes: number;
  liked: boolean;
  replyCount: number;
  mine: boolean;
  canDelete: boolean;
  replies?: SprintComment[];
};

export function listComments(token: string, ideaId: string, sort: "top" | "new", cursor?: string | null) {
  const q = new URLSearchParams({ sort });
  if (cursor) q.set("cursor", cursor);
  return request<{ comments: SprintComment[]; nextCursor: string | null; total: number }>(`/campus/ideas/${ideaId}/comments?${q}`, token);
}

export function listReplies(token: string, commentId: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ replies: SprintComment[]; nextCursor: string | null }>(`/campus/comments/${commentId}/replies${q}`, token);
}

export function postComment(token: string, ideaId: string, body: string, parentId?: string) {
  return request<{ comment: SprintComment }>(`/campus/ideas/${ideaId}/comments`, token, {
    method: "POST",
    body: JSON.stringify({ body, parentId }),
  });
}

export function deleteComment(token: string, commentId: string) {
  return request<{ deleted: true }>(`/campus/comments/${commentId}`, token, { method: "DELETE" });
}

export function setLike(token: string, targetType: "idea" | "comment", targetId: string, liked: boolean) {
  return request<{ liked: boolean; likes: number }>("/campus/reactions", token, {
    method: liked ? "POST" : "DELETE",
    body: JSON.stringify({ targetType, targetId }),
  });
}

/** "I'd use this": a demand signal, separate from likes. */
export function setWant(token: string, ideaId: string, wanted: boolean) {
  return request<{ wanted: boolean; wants: number; campusWants: number }>(`/campus/ideas/${ideaId}/want`, token, { method: wanted ? "POST" : "DELETE", body: "{}" });
}

export type TeamMessage = { id: string; mine: boolean; name: string; isOwner: boolean; former: boolean; body: string; createdAt: string };
export function listTeamMessages(token: string, ideaId: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ memberCount: number; messages: TeamMessage[]; nextCursor: string | null }>(`/campus/ideas/${ideaId}/thread${q}`, token);
}
export function postTeamMessage(token: string, ideaId: string, body: string) {
  return request<{ message: TeamMessage }>(`/campus/ideas/${ideaId}/thread`, token, { method: "POST", body: JSON.stringify({ body }) });
}

export function recordShare(token: string, ideaId: string) {
  return request<{ shares: number }>(`/campus/ideas/${ideaId}/share`, token, { method: "POST" });
}

export type CampusProfile = {
  profile: {
    id: string;
    isSelf: boolean;
    displayName: string;
    headline: string | null;
    university: string | null;
    degree: string | null;
    branch: string | null;
    semester: number | null;
    graduationYear: number | null;
    cgpa: number | null;
    twoWeekLine: string | null;
    interests: string[];
    skills: { name: string; signed: boolean }[];
    githubUrl: string | null;
    githubLogin: string | null;
    githubStats: { publicRepos: number; followers: number; topLanguages: string[]; checkedAt: string } | null;
    linkedinUrl: string | null;
    siteUrl: string | null;
    projects: { title: string; url?: string; summary?: string }[];
    certifications: { name: string; issuer?: string; year?: number; url?: string }[];
    experience: { role: string; org: string; period?: string }[];
    circle: { id: number; label: string } | null;
    proofPublished: boolean;
    joinedAt: string;
    profilePicUrl?: string | null;
    coverUrl?: string | null;
    currentlyWorkingOn?: string | null;
    followerCount?: number;
    followingCount?: number;
    viewerFollows?: boolean;
    activityStreak?: number;
    verifiedStudent?: boolean;
    handle?: string;
    country?: string | null;
    city?: string | null;
  };
  stats: { ideasPosted: number; teamsJoined: number; shipped: number; signedTasks: number; likesReceived: number; comments: number };
  teams: { ideaId: string; title: string; teamStatus: string; joinedAt: string; leftAt: string | null }[];
  currentlyWorking?: { ideaId: string; title: string; teamStatus: string; role: string }[];
  signedTrail?: { taskId: string; role: string | null; signedAt: string | null; ideaId: string; ideaTitle: string }[];
};

export function getCampusProfile(token: string, id: string) {
  return request<CampusProfile>(`/campus/people/${id}`, token);
}

export function followCampusPerson(token: string, id: string) {
  return request<{ following: boolean }>(`/campus/people/${id}/follow`, token, { method: "POST" });
}

export function unfollowCampusPerson(token: string, id: string) {
  return request<{ following: boolean }>(`/campus/people/${id}/follow`, token, { method: "DELETE" });
}

export function uploadProfileMedia(token: string, slot: "avatar" | "cover", file: File) {
  const body = new FormData();
  body.set("image", file);
  return request<{ url: string; slot: string }>(`/campus/profile/media/${slot}`, token, { method: "POST", body });
}

export function getProfileIdeas(token: string, id: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ ideas: SprintIdea[]; nextCursor: string | null }>(`/campus/people/${id}/ideas${q}`, token);
}

export type SprintProblem = {
  sameCampus?: boolean;
  id: string;
  title: string;
  whatHappens: string;
  whoFeels: string;
  fixWouldChange: string;
  source: string;
  hideName: boolean;
  authorName: string;
  authorBranch: string | null;
  authorSemester: number | null;
  createdAt: string;
  authorId: string | null;
  ideaId: string | null;
  hasIdea: boolean;
  needsFreshLine: boolean;
  freshLine: string | null;
  hidden: boolean;
  saved: boolean;
  approach?: { body: string; contactEmail: string } | null;
};

export function requestCampusCode(email: string) {
  return request<{ sent: boolean }>("/auth/campus/request-code", null, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyCampusCode(email: string, code: string) {
  return request<{ token: string; user: import("@embedra/types").UserResponse; suggestedBranch: string | null }>(
    "/auth/campus/verify",
    null,
    { method: "POST", body: JSON.stringify({ email, code }) },
  );
}

export const MICROSOFT_STATE_KEY = "attest_microsoft_state";
export const GOOGLE_STATE_KEY = "attest_google_state";

export type SignInMethods = { google: boolean; microsoft: boolean; emailCode: boolean; emailCodeTestOnly: boolean };
/** Which sign-in methods this server has set up, so the page never shows a dead button. */
export function getSignInMethods() {
  return request<SignInMethods>("/auth/campus/methods", null);
}

export function startGoogleSignIn(next: string | null) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return request<{ url: string; state: string }>(`/auth/campus/google/start${query}`, null);
}

export function completeGoogleSignIn(code: string, state: string) {
  return request<{ token: string; user: import("@embedra/types").UserResponse; next: string | null }>(
    "/auth/campus/google/callback",
    null,
    { method: "POST", body: JSON.stringify({ code, state }) },
  );
}

export function startMicrosoftSignIn(next: string | null) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return request<{ url: string; state: string }>(`/auth/campus/microsoft/start${query}`, null);
}

export function completeMicrosoftSignIn(code: string, state: string) {
  return request<{ token: string; user: import("@embedra/types").UserResponse; next: string | null }>(
    "/auth/campus/microsoft/callback",
    null,
    { method: "POST", body: JSON.stringify({ code, state }) },
  );
}

export function saveCampusProfile(token: string, body: unknown) {
  return request<{ user: import("@embedra/types").UserResponse }>("/campus/profile", token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function listSprintIdeas(token: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return request<{ ideas: SprintIdea[]; nextCursor: string | null }>(`/campus/ideas?${q}`, token);
}

export type FeedIdea = SprintIdea & { reasons: string[]; topics: string[] };

export type FeedPage = {
  ideas: FeedIdea[];
  nextCursor: string | null;
  personalized: boolean;
  usingModel: boolean;
  suggestedInterests: string[];
};

export function getForYouFeed(token: string, cursor?: string | null, campusOnly = false) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (campusOnly) params.set("campus", "1");
  const q = params.size ? `?${params}` : "";
  return request<FeedPage>(`/campus/feed${q}`, token);
}

export function similarSprintIdeas(token: string, ideaId: string) {
  return request<{ ideas: (SprintIdea & { topics: string[] })[] }>(`/campus/ideas/${ideaId}/similar`, token);
}

export function relatedInterests(token: string) {
  return request<{ related: Record<string, string[]> }>("/campus/interests/related", token);
}

export function addInterest(token: string, label: string) {
  return request<{ interests: string[] }>("/campus/profile/interests", token, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function branchPopularity(token: string, branch: string) {
  return request<{ interests: string[]; skills: string[]; students: number }>(
    `/campus/interests/popular?${new URLSearchParams({ branch })}`,
    token,
  );
}

export type PeopleScope = "all" | "campus" | "branch" | "cohort";

export type Person = {
  id: string;
  displayName: string | null;
  branch: string | null;
  semester: number | null;
  degree: string | null;
  university: string | null;
  headline: string | null;
  interests: string[];
  skills: string[];
  githubLogin: string | null;
  circle: { id: number; label: string } | null;
  sharedInterests: string[];
  sharedSkills: string[];
  match: number;
  reasons: string[];
};

export type PeoplePage = {
  people: Person[];
  nextCursor: string | null;
  circle: { id: number; label: string; topics: string[]; size: number } | null;
  circles: { id: number; label: string; size: number }[];
  myOpenIdeas: { id: string; title: string }[];
  usingModel: boolean;
};

export function listPeople(token: string, scope: PeopleScope, cursor?: string | null) {
  const q = new URLSearchParams({ scope });
  if (cursor) q.set("cursor", cursor);
  return request<PeoplePage>(`/campus/people?${q}`, token);
}

export function invitePerson(token: string, personId: string, ideaId: string) {
  return request<{ invited: true }>(`/campus/people/${personId}/invite`, token, {
    method: "POST",
    body: JSON.stringify({ ideaId }),
  });
}

export type UploadedDocument = {
  id: string;
  kind: "resume" | "certificate" | "idea_brief";
  filename: string;
  status: "queued" | "parsed" | "failed";
  result: import("@embedra/types").DocumentExtraction | null;
  error: string | null;
};

export function uploadDocument(token: string, kind: "resume" | "certificate" | "idea_brief", file: File) {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  return request<{ id: string; status: string }>("/campus/documents", token, { method: "POST", body });
}

export function getDocument(token: string, id: string) {
  return request<UploadedDocument>(`/campus/documents/${id}`, token);
}

/** Polls until the background parser finishes. Parsing a scanned page takes a few seconds. */
export async function waitForDocument(token: string, id: string, timeoutMs = 90_000) {
  const started = Date.now();
  let delay = 800;
  while (Date.now() - started < timeoutMs) {
    const doc = await getDocument(token, id);
    if (doc.status !== "queued") return doc;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(3_000, delay * 1.4);
  }
  throw new CampusApiError("Still reading the file. Try again in a minute.", 504);
}

export type InteractionKind = "view" | "dwell" | "not_interested" | "undo_not_interested";

/** Feed signal. Fire-and-forget; keepalive lets the dwell ping survive leaving the page. */
export function logInteraction(token: string, ideaId: string, kind: InteractionKind, dwellMs?: number) {
  return fetch(`${API_BASE}/campus/interactions`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ideaId, kind, dwellMs }),
  }).catch(() => undefined);
}

export function getSprintIdea(token: string, id: string) {
  return request<{ idea: SprintIdea }>(`/campus/ideas/${id}`, token);
}

export function createSprintIdea(token: string, body: unknown) {
  return request<{ idea: SprintIdea }>("/campus/ideas", token, { method: "POST", body: JSON.stringify(body) });
}

export function uploadSprintIdeaImage(token: string, ideaId: string, file: File) {
  const body = new FormData();
  body.set("image", file);
  return request<{ id: string; imageUrl: string; role: string }>(`/campus/ideas/${ideaId}/images`, token, {
    method: "POST",
    body,
  });
}

export function deleteSprintIdeaImage(token: string, ideaId: string, imageId: string) {
  return request<{ ok: true }>(`/campus/ideas/${ideaId}/images/${imageId}`, token, { method: "DELETE" });
}

export function listSprintProblems(token: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return request<{ problems: SprintProblem[]; nextCursor: string | null }>(`/campus/problems?${q}`, token);
}

export function getSprintProblem(token: string, id: string) {
  return request<{ problem: SprintProblem }>(`/campus/problems/${id}`, token);
}

export function createSprintProblem(token: string, body: unknown) {
  return request<{ problem: SprintProblem }>("/campus/problems", token, { method: "POST", body: JSON.stringify(body) });
}

export function createOffer(token: string, body: unknown) {
  return request<{ offer: { id: string } }>("/campus/offers", token, { method: "POST", body: JSON.stringify(body) });
}

export function getOffer(token: string, id: string) {
  return request<OfferScreen>(`/campus/offers/${id}`, token);
}

export type OfferScreen = {
  offer: {
    id: string;
    status: string;
    body: string;
    hoursPerWeek: number;
    availableDays: string[];
    links: string[];
    skills?: string[];
    phases?: string[];
    proposal: {
      title?: string;
      pitch?: string;
      audience?: string;
      gap?: string;
      ships?: string;
      helpNeeded?: string[];
      stage?: string;
      isSmall?: boolean;
      hourCap?: number | null;
    } | null;
    ideaId: string | null;
    problemId: string | null;
    builderId: string;
  };
  profile: {
    displayName: string | null;
    branch: string | null;
    semester: number | null;
    twoWeekLine: string | null;
    skills: { name: string; signed: boolean }[];
    university: string | null;
    degree: string | null;
    graduationYear: number | null;
    cgpa: number | null;
    headline: string | null;
    githubUrl: string | null;
    githubLogin: string | null;
    githubStats: { publicRepos: number; followers: number; topLanguages: string[]; checkedAt: string } | null;
    linkedinUrl: string | null;
    siteUrl: string | null;
    projects: { title: string; url?: string; summary?: string }[];
    certifications: { name: string; issuer?: string; year?: number; url?: string }[];
    experience: { role: string; org: string; period?: string }[];
    profilePicUrl?: string | null;
    coverUrl?: string | null;
    currentlyWorkingOn?: string | null;
    finished: number;
    dropped: number;
  } | null;
  tryout: { brief: string; hourCap: number; outcome: string | null } | null;
  canDecide: boolean;
};

export function acceptOffer(token: string, id: string) {
  return request<{ ideaId: string }>(`/campus/offers/${id}/accept`, token, { method: "POST" });
}
export function declineOffer(token: string, id: string) {
  return request(`/campus/offers/${id}/decline`, token, { method: "POST" });
}
export function assignTryout(token: string, id: string, brief: string, hourCap: number) {
  return request(`/campus/offers/${id}/tryout`, token, { method: "POST", body: JSON.stringify({ brief, hourCap }) });
}

export type InboxOffer = {
  id: string;
  status: string;
  body: string;
  title: string;
  hoursPerWeek: number;
  availableDays?: string[];
  skills?: string[];
  phases?: string[];
  links?: string[];
  ideaId?: string | null;
  problemId?: string | null;
  kind?: "idea" | "problem";
  createdAt?: string;
  fitScore?: number;
  fitReasons?: string[];
  builder?: {
    id: string;
    displayName: string;
    branch: string | null;
    semester: number | null;
    headline: string | null;
    skills: string[];
    signedTasks: number;
    githubUrl: string | null;
    profilePicUrl: string | null;
  } | null;
};

export type InboxAction = {
  id: string;
  priority: number;
  type: "offer" | "invite" | "day7" | "sign" | "tryout";
  title: string;
  body: string;
  href: string;
  meta?: string;
};

export type InboxPayload = {
  summary: {
    actionCount: number;
    unreadNotices: number;
    pendingOffers: number;
    pendingInvites: number;
    awaitingSignature: number;
    outgoingOpen: number;
    usingModel: boolean;
  };
  actions: InboxAction[];
  incoming: { new: InboxOffer[]; tryout: InboxOffer[]; decided: InboxOffer[] };
  outgoing: {
    id: string;
    status: string;
    body: string;
    hoursPerWeek: number;
    skills: string[];
    phases: string[];
    ideaId: string | null;
    problemId: string | null;
    title: string;
    kind: "idea" | "problem";
    createdAt: string;
    href: string;
  }[];
  invites: {
    id: string;
    ideaId: string;
    email: string;
    status: string;
    createdAt: string;
    title: string;
    teamStatus: string;
    href: string;
  }[];
  notices: {
    id: string;
    body: string;
    targetId?: string | null;
    readAt: string | null;
    createdAt: string;
    kind: "day7" | "team" | "social" | "notice";
    href: string | null;
  }[];
  signatures: {
    taskId: string;
    title: string;
    role: string | null;
    ideaId: string;
    ideaTitle: string;
    assigneeName: string;
    href: string;
  }[];
};

export function getInbox(token: string) {
  return request<InboxPayload>("/campus/inbox", token);
}

export function getInboxBadge(token: string) {
  return request<{
    count: number;
    unreadNotices: number;
    pendingOffers: number;
    pendingInvites: number;
    awaitingSignature: number;
  }>("/campus/inbox/badge", token);
}

export function markNoticeRead(token: string, id: string) {
  return request<{ ok: true }>(`/campus/notices/${id}/read`, token, { method: "POST" });
}

export function markAllNoticesRead(token: string) {
  return request<{ ok: true }>("/campus/notices/read-all", token, { method: "POST" });
}

export function getWork(token: string, ideaId: string) {
  return request<WorkScreen>(`/campus/ideas/${ideaId}/work`, token);
}

export type WorkScreen = {
  idea: SprintIdea;
  approach: { body: string; contactEmail: string } | null;
  roster: { userId: string; name: string; role: string; leftAt: string | null; exitReason?: string | null }[];
  tasks: {
    id: string;
    title: string;
    description: string;
    links: string[];
    role: string | null;
    status: string;
    assigneeId: string | null;
    receiptStatus: string | null;
    frozenAt: string | null;
  }[];
  checkIns: { userId: string; done: string; stuck: string; next: string }[];
  reopenedUserIds: string[];
  day7?: string;
  endsAt?: string;
  isAuthor: boolean;
};

export function addTask(token: string, ideaId: string, body: unknown) {
  return request(`/campus/ideas/${ideaId}/tasks`, token, { method: "POST", body: JSON.stringify(body) });
}
export function taskAction(token: string, id: string, action: "start" | "submit" | "sign" | "dispute", body?: unknown) {
  return request(`/campus/tasks/${id}/${action}`, token, {
    method: action === "start" ? "POST" : "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
export function updateTask(token: string, id: string, description: string, links: string[]) {
  return request(`/campus/tasks/${id}`, token, { method: "PATCH", body: JSON.stringify({ description, links }) });
}
export function reassignTask(token: string, id: string, assigneeId: string | null) {
  return request(`/campus/tasks/${id}/assignee`, token, { method: "PATCH", body: JSON.stringify({ assigneeId }) });
}
export function checkIn(token: string, ideaId: string, body: unknown) {
  return request(`/campus/ideas/${ideaId}/check-in`, token, { method: "POST", body: JSON.stringify(body) });
}
export function shipIdea(token: string, ideaId: string) {
  return request(`/campus/ideas/${ideaId}/ship`, token, { method: "POST" });
}
export function inviteMember(token: string, ideaId: string, email: string) {
  return request(`/campus/ideas/${ideaId}/invite`, token, { method: "POST", body: JSON.stringify({ email }) });
}
export function leaveTeam(token: string, ideaId: string) {
  return request(`/campus/ideas/${ideaId}/leave`, token, { method: "POST" });
}
export function removeMember(token: string, ideaId: string, userId: string, reason: string) {
  return request(`/campus/ideas/${ideaId}/remove`, token, { method: "POST", body: JSON.stringify({ userId, reason }) });
}
export function forkIdea(token: string, ideaId: string) {
  return request<{ idea: SprintIdea }>(`/campus/ideas/${ideaId}/fork`, token, { method: "POST" });
}
export function getInvite(token: string, id: string) {
  return request<{
    invite: { id: string; status: string; createdAt: string; email: string };
    idea: {
      id: string;
      title: string;
      blurb: string | null;
      stage: string;
      teamStatus: string;
      helpNeeded: string[];
      seatsOpen: boolean;
      collaboratorCount: number;
    };
    owner: { id: string; displayName: string; branch: string | null; semester: number | null; headline: string | null } | null;
  }>(`/campus/invites/${id}`, token);
}

export function respondInvite(token: string, id: string, action: "accept" | "decline") {
  return request<{ status: string; ideaId?: string }>(`/campus/invites/${id}`, token, { method: "POST", body: JSON.stringify({ action }) });
}
export function getProof(token: string, id?: string) {
  return request<{ published: boolean; own?: boolean; displayName: string | null; lines: ProofLine[] }>(
    id ? `/campus/proof/${id}` : "/campus/proof",
    token,
  );
}
type ProofLine = {
  id: string;
  title: string;
  description: string;
  role?: string | null;
  receiptStatus: string | null;
  status?: string | null;
  frozenAt: string | null;
  signedAt: string | null;
  removedAt: string | null;
};
export function publishProof(token: string, published: boolean) {
  return request("/campus/proof", token, { method: "POST", body: JSON.stringify({ published }) });
}
export function fileReport(token: string, targetType: "idea" | "problem", targetId: string, reason: "spam" | "copied work") {
  return request("/campus/reports", token, { method: "POST", body: JSON.stringify({ targetType, targetId, reason }) });
}
export function listReports(token: string) {
  return request<{ reports: { id: string; targetType: string; targetId: string; reason: string; createdAt: string }[] }>("/campus/reports", token);
}
export function resolveReport(token: string, id: string, action: "restore" | "keep") {
  return request(`/campus/reports/${id}/resolve`, token, { method: "POST", body: JSON.stringify({ action }) });
}
export function saveCard(token: string, targetType: "idea" | "problem", targetId: string, saved: boolean) {
  return request("/campus/saves", token, {
    method: saved ? "POST" : "DELETE",
    body: JSON.stringify({ targetType, targetId }),
  });
}

export function listSavedIdeas(token: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ ideas: SprintIdea[]; problems?: SprintProblem[]; nextCursor: string | null }>(`/campus/saves${q}`, token);
}

export function draftText(token: string, kind: "idea" | "problem" | "help", notes: string) {
  return request<{ enabled: boolean; draft: string | null; message?: string }>("/campus/draft", token, {
    method: "POST",
    body: JSON.stringify({ kind, notes }),
  });
}
export function getHelp(token: string) {
  return request<{ answers: { q: string; a: string }[] }>("/campus/help", token);
}
export function addFreshLine(token: string, id: string, freshLine: string) {
  return request(`/campus/problems/${id}/fresh-line`, token, { method: "POST", body: JSON.stringify({ freshLine }) });
}

// ---------- MARKETPLACE PHASE 1: deals, milestones, payments, reviews, threads ----------
export type DealParty = { id: string; handle: string; displayName: string | null; isAdult: boolean } | null;
export type DealMilestone = {
  id: string;
  position: number;
  title: string;
  amountMinor: number;
  amount: string | null;
  dueAt: string | null;
  status: "open" | "submitted" | "accepted" | "auto_accepted" | "disputed" | "payment_confirmed";
  deliverableLinks: string[];
  note: string | null;
  submittedAt: string | null;
  acceptanceDeadline: string | null;
  acceptedAt: string | null;
  disputedAt: string | null;
  disputeReason: string | null;
  payment: { method: string; reference: string | null; payerConfirmedAt: string | null; payeeConfirmedAt: string | null } | null;
};
export type DealReview = { onTime: number; communication: number; quality: number; wouldWorkAgain: boolean; note: string | null; createdAt: string };
export type Deal = {
  id: string;
  role: "requester" | "builder" | "admin";
  idea: { id: string; title: string } | null;
  gig?: { id: string; title: string } | null;
  title?: string;
  requester: DealParty;
  builder: DealParty;
  dealType: string;
  paid: boolean;
  currency: string | null;
  totalAmountMinor: number;
  total: string | null;
  licence: string | null;
  ipTerms: string;
  nda: boolean;
  status: "proposed" | "active" | "completed" | "cancelled";
  createdAt: string;
  builderAcceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  threadOpen: boolean;
  paymentNotice: string | null;
  milestones: DealMilestone[];
  reviews: { canReview: boolean; revealed: boolean; mine: DealReview | null; theirs: DealReview | null; waitingOnOther: boolean };
};
export type DealSummary = {
  id: string;
  role: "requester" | "builder";
  ideaTitle: string;
  isGig?: boolean;
  otherHandle: string | null;
  dealType: string;
  total: string | null;
  status: Deal["status"];
  milestonesDone: number;
  milestonesTotal: number;
  needsYou: boolean;
  createdAt: string;
};
export type DealMessage = { id: string; mine: boolean; handle: string; body: string; flag: string | null; createdAt: string };
export type HelpEvent = { kind: string; at: string; title: string; detail: string | null; ideaId: string | null };
export type PersonRecord = {
  handle?: string;
  tipUrl?: string | null;
  memberSince?: string;
  verifiedStudent?: boolean;
  trust?: { peopleHelped: number; milestonesAccepted: number; tasksSigned: number; dealsCompleted: number; dealsDropped: number };
  history?: HelpEvent[];
  reviews: { count: number; onTime: number[]; communication: number[]; quality: number[]; wouldWorkAgain: { yes: number; no: number } };
  deals: { id: string; title: string; role: string; dealType: string; milestonesDone: number; paidMilestones: number; paidConfirmed: string | null; completedAt: string | null }[];
};
export type NewDealInput = {
  ideaId: string;
  builderId: string;
  dealType: string;
  currency?: string | null;
  licence?: string | null;
  ipTerms?: string;
  nda: boolean;
  milestones: { title: string; amount: number; dueAt?: string | null }[];
  notAcademicWork: true;
};

const post = (body?: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body ?? {}) });

export function listDeals(token: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ engagements: DealSummary[]; nextCursor: string | null }>(`/campus/engagements${q}`, token);
}
export function getDeal(token: string, id: string) {
  return request<{ engagement: Deal }>(`/campus/engagements/${id}`, token);
}
export function createDeal(token: string, input: NewDealInput) {
  return request<{ engagement: Deal }>("/campus/engagements", token, post(input));
}
export function acceptDeal(token: string, id: string) {
  return request<{ engagement: Deal }>(`/campus/engagements/${id}/accept`, token, post());
}
export function cancelDeal(token: string, id: string, reason: string) {
  return request<{ engagement: Deal }>(`/campus/engagements/${id}/cancel`, token, post({ reason }));
}
export function reviewDeal(token: string, id: string, review: { onTime: number; communication: number; quality: number; wouldWorkAgain: boolean; note?: string }) {
  return request<{ engagement: Deal }>(`/campus/engagements/${id}/review`, token, post(review));
}
export function submitMilestone(token: string, id: string, links: string[], note?: string) {
  return request<{ engagement: Deal }>(`/campus/milestones/${id}/submit`, token, post({ links, note }));
}
export function acceptMilestone(token: string, id: string) {
  return request<{ engagement: Deal }>(`/campus/milestones/${id}/accept`, token, post());
}
export function disputeMilestone(token: string, id: string, reason: string) {
  return request<{ engagement: Deal }>(`/campus/milestones/${id}/dispute`, token, post({ reason }));
}
export function recordMilestonePayment(token: string, id: string, method: string, reference?: string) {
  return request<{ engagement: Deal }>(`/campus/milestones/${id}/payment`, token, post({ method, reference: reference || undefined }));
}
export function confirmMilestonePayment(token: string, id: string) {
  return request<{ engagement: Deal }>(`/campus/milestones/${id}/payment/confirm`, token, post());
}
export function listDealMessages(token: string, id: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ open: boolean; messages: DealMessage[]; nextCursor: string | null }>(`/campus/engagements/${id}/messages${q}`, token);
}
export function postDealMessage(token: string, id: string, body: string) {
  return request<{ message: DealMessage; warning: string | null }>(`/campus/engagements/${id}/messages`, token, post({ body }));
}
export function getPersonRecord(token: string, id: string) {
  return request<PersonRecord>(`/campus/people/${id}/record`, token);
}

// Account
export function setMyHandle(token: string, handle: string) {
  return request<{ handle: string }>("/campus/me/handle", token, { method: "PUT", body: JSON.stringify({ handle }) });
}
export function confirmAdult(token: string) {
  return request<{ isAdult: boolean }>("/campus/me/adult", token, post({ isAdult: true }));
}
export function setMyPrivacy(token: string, showInstitution: boolean) {
  return request<{ showInstitution: boolean }>("/campus/me/privacy", token, { method: "PUT", body: JSON.stringify({ showInstitution }) });
}
export function setMyTip(token: string, tipUrl: string) {
  return request<{ tipUrl: string | null }>("/campus/me/tip", token, { method: "PUT", body: JSON.stringify({ tipUrl }) });
}
export function sendAppeal(token: string, text: string) {
  return request<{ appealed: boolean }>("/campus/me/appeal", token, post({ text }));
}

// Moderation (admin)
export type IntegrityFlag = { id: string; targetType: string; targetId: string; title: string | null; source: string; label: string; score: number | null; matched: string | null; createdAt: string };
export type SuspensionAppeal = { id: string; username: string; suspendedReason: string | null; suspensionAppeal: string | null; appealedAt: string | null };
export function listIntegrityFlags(token: string, cursor?: string | null) {
  const q = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  return request<{ flags: IntegrityFlag[]; appeals: SuspensionAppeal[]; nextCursor: string | null }>(`/campus/admin/integrity${q}`, token);
}
export function resolveIntegrityFlag(token: string, id: string, action: "clear" | "confirm") {
  return request<{ ok: true }>(`/campus/admin/integrity/${id}`, token, post({ action }));
}
export function suspendPerson(token: string, id: string, reason: string) {
  return request<{ ok: true }>(`/campus/admin/users/${id}/suspend`, token, post({ reason }));
}
export function unsuspendPerson(token: string, id: string) {
  return request<{ ok: true }>(`/campus/admin/users/${id}/unsuspend`, token, post());
}

// ---------- GIGS (quick freelancing) ----------
export type Gig = {
  id: string;
  kind: "request" | "offer";
  title: string;
  description: string;
  category: string;
  dealType: string;
  paid: boolean;
  currency: string | null;
  priceMinor: number | null;
  price: string | null;
  deliveryDays: number | null;
  campusOnly: boolean;
  sameCampus: boolean;
  status: "open" | "closed";
  hidden: boolean;
  createdAt: string;
  author: { id: string; handle: string };
  mine: boolean;
  responseCount?: number;
  kitId?: string | null;
};
export type GigResponse = {
  id: string;
  note: string;
  status: "new" | "hired" | "declined";
  engagementId: string | null;
  createdAt: string;
  user?: { id: string; handle: string; isAdult: boolean; sameCampus: boolean };
};
export type GigDetail = { gig: Gig; responses: GigResponse[]; myResponse: GigResponse | null };

export function listGigs(token: string, params: { kind: "request" | "offer"; campus?: boolean; category?: string; mine?: boolean; cursor?: string | null }) {
  const q = new URLSearchParams({ kind: params.kind });
  if (params.campus) q.set("campus", "1");
  if (params.category) q.set("category", params.category);
  if (params.mine) q.set("mine", "1");
  if (params.cursor) q.set("cursor", params.cursor);
  return request<{ gigs: Gig[]; nextCursor: string | null }>(`/campus/gigs?${q}`, token);
}
export function createGig(token: string, body: unknown) {
  return request<{ gig: Gig }>("/campus/gigs", token, { method: "POST", body: JSON.stringify(body) });
}
export function getGig(token: string, id: string) {
  return request<GigDetail>(`/campus/gigs/${id}`, token);
}
export function respondToGig(token: string, id: string, note: string) {
  return request<{ response: GigResponse }>(`/campus/gigs/${id}/respond`, token, { method: "POST", body: JSON.stringify({ note }) });
}
export function closeGig(token: string, id: string) {
  return request<{ ok: true }>(`/campus/gigs/${id}/close`, token, { method: "POST", body: "{}" });
}
export function acceptGigResponse(token: string, responseId: string) {
  return request<{ engagementId: string }>(`/campus/gig-responses/${responseId}/accept`, token, { method: "POST", body: "{}" });
}
export function declineGigResponse(token: string, responseId: string) {
  return request<{ ok: true }>(`/campus/gig-responses/${responseId}/decline`, token, { method: "POST", body: "{}" });
}

// ---------- KITS (organiser need lists) ----------
export type Kit = {
  id: string; name: string; kind: string; description: string | null; eventDate: string | null;
  campusOnly: boolean; sameCampus: boolean; status: "open" | "closed"; createdAt: string;
  owner: { id: string; handle: string }; mine: boolean; needs: number; filled: number;
};
export type KitNeed = Gig & { stage: "open" | "closed" | "hired" | "review" | "delivered" | "paid" | "cancelled"; builderHandle: string | null; engagementId: string | null; kitId?: string | null };
export type KitDetail = {
  kit: Kit; needs: KitNeed[];
  totals: { needs: number; open: number; inProgress: number; done: number; budget: string | null; paidConfirmed: string | null };
};
export function listKits(token: string, params: { campus?: boolean; mine?: boolean; cursor?: string | null }) {
  const q = new URLSearchParams();
  if (params.campus) q.set("campus", "1");
  if (params.mine) q.set("mine", "1");
  if (params.cursor) q.set("cursor", params.cursor);
  return request<{ kits: Kit[]; nextCursor: string | null }>(`/campus/kits${q.size ? `?${q}` : ""}`, token);
}
export function createKit(token: string, body: unknown) {
  return request<{ kit: Kit }>("/campus/kits", token, { method: "POST", body: JSON.stringify(body) });
}
export function getKit(token: string, id: string) {
  return request<KitDetail>(`/campus/kits/${id}`, token);
}
export function addKitNeed(token: string, id: string, body: unknown) {
  return request<KitDetail>(`/campus/kits/${id}/needs`, token, { method: "POST", body: JSON.stringify(body) });
}
export function closeKit(token: string, id: string) {
  return request<{ ok: true }>(`/campus/kits/${id}/close`, token, { method: "POST", body: "{}" });
}

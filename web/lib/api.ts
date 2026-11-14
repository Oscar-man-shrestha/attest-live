import {
  Domain,
  CreateIdeaInput,
  UpdateIdeaInput,
  IdeaResponse,
  LoginInput,
  SignupInput,
  AuthResponse,
  UserResponse,
  JoinRequestResponse,
  PaginatedJoinRequestsResponse,
  ProcessJoinRequestInput,
  GroupResponse,
  GroupMemberResponse,
  PaginatedGroupMembersResponse,
  GroupMessageResponse,
  PaginatedMessagesResponse,
  Skill,
  ProfileResponse,
  UpdateProfileInput,
} from "@embedra/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || data.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data.details);
  }

  return data as T;
}

// ---------- DOMAIN LOOKUP ----------
export async function getDomains(): Promise<Domain[]> {
  return request<Domain[]>("/domains");
}

// ---------- IDEA CRUD ----------
export async function getIdea(id: string, token?: string): Promise<IdeaResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return request<IdeaResponse>(`/ideas/${id}`, {
    method: "GET",
    headers,
  });
}

export async function createIdea(
  input: CreateIdeaInput,
  token: string
): Promise<{ idea: IdeaResponse; group: any }> {
  return request<{ idea: IdeaResponse; group: any }>("/ideas", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function updateIdea(
  id: string,
  input: UpdateIdeaInput,
  token: string
): Promise<IdeaResponse> {
  return request<IdeaResponse>(`/ideas/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function deleteIdea(id: string, token: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/ideas/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// ---------- JOIN FLOW ----------

export async function requestJoin(
  ideaId: string,
  token: string
): Promise<JoinRequestResponse> {
  return request<JoinRequestResponse>(`/ideas/${ideaId}/request-join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getJoinRequests(
  ideaId: string,
  token: string,
  cursor?: string
): Promise<PaginatedJoinRequestsResponse> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<PaginatedJoinRequestsResponse>(
    `/ideas/${ideaId}/join-requests${qs}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function processJoinRequest(
  ideaId: string,
  requestId: string,
  action: ProcessJoinRequestInput["action"],
  token: string
): Promise<JoinRequestResponse> {
  return request<JoinRequestResponse>(
    `/ideas/${ideaId}/join-requests/${requestId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    }
  );
}

export async function joinViaInvite(
  inviteToken: string,
  token: string
): Promise<{ message: string; groupId: string; ideaId: string }> {
  return request<{ message: string; groupId: string; ideaId: string }>(
    `/ideas/join-via-invite/${inviteToken}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function regenerateInvite(
  ideaId: string,
  token: string
): Promise<{ inviteToken: string }> {
  return request<{ inviteToken: string }>(
    `/ideas/${ideaId}/regenerate-invite`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// ---------- AUTH ----------
export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function signupUser(input: SignupInput): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getMe(token: string): Promise<{ user: UserResponse }> {
  return request<{ user: UserResponse }>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// ---------- GROUPS & MEMBERS ----------
export async function getGroup(
  id: string,
  token: string
): Promise<GroupResponse & { ownerId?: string }> {
  return request<GroupResponse & { ownerId?: string }>(`/groups/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getGroupMembers(
  id: string,
  token: string,
  cursor?: string
): Promise<PaginatedGroupMembersResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<PaginatedGroupMembersResponse>(`/groups/${id}/members${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getGroupMessages(
  groupId: string,
  token: string,
  cursor?: string
): Promise<PaginatedMessagesResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<PaginatedMessagesResponse>(`/groups/${groupId}/messages${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  token: string
): Promise<{ message: string }> {
  return request<{ message: string }>(`/groups/${groupId}/members/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// ---------- FEED / IDEAS LIST ----------
export interface FeedIdea {
  id: string;
  title: string;
  description: string;
  domainId: string;
  accessType: string;
  status: string;
  createdAt: string;
}

export interface PaginatedFeedResponse {
  ideas: FeedIdea[];
  nextCursor: string | null;
}

export async function getUserIdeas(
  userId: string,
  cursor?: string,
  token?: string
): Promise<PaginatedFeedResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request<PaginatedFeedResponse>(`/users/${userId}/ideas${query}`, {
    method: "GET",
    headers,
  });
}

// ---------- SKILLS ----------
export async function getSkills(): Promise<Skill[]> {
  return request<Skill[]>("/skills");
}

// ---------- USER PROFILE ----------
export async function getUserProfile(
  id: string,
  token?: string
): Promise<ProfileResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return request<ProfileResponse>(`/users/${id}`, {
    method: "GET",
    headers,
  });
}

export async function updateMyProfile(
  input: UpdateProfileInput,
  token: string
): Promise<any> {
  return request<any>("/users/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function addMySkill(
  skillId: string,
  token: string
): Promise<any> {
  return request<any>("/users/me/skills", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ skillId }),
  });
}

export async function removeMySkill(
  skillId: string,
  token: string
): Promise<{ message: string }> {
  return request<{ message: string }>(`/users/me/skills/${skillId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "http://localhost:5001";
  }
}

export { ApiError };

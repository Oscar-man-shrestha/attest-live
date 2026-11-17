"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Legacy Embedra editor — ideas are edited by posting a fork or updating in workspace. */
export default function EditIdeaPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const ideaId = params?.id as string;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/ideas/${ideaId}`)}`);
      return;
    }
    router.replace(`/ideas/${ideaId}`);
  }, [isLoading, user, ideaId, router]);

  return (
    <div className="px-5 py-10 max-w-lg mx-auto space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Sprint ideas</p>
      <h1 className="font-serif text-[28px] font-semibold">Editing moved</h1>
      <p className="text-[14px] text-[#464555]">
        Ideas stay on the public brief you posted. Need a different angle? Fork the public slice and start your own related idea — private approach notes are never copied.
      </p>
      <div className="flex gap-3">
        <Link href={`/ideas/${ideaId}`} className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">
          Open idea
        </Link>
        <Link href="/ideas/new" className="px-4 py-2 rounded-lg border border-[#c7c4d8] text-[13px] font-semibold">
          Post new idea
        </Link>
      </div>
    </div>
  );
}

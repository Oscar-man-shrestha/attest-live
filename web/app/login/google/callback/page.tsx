"use client";

import { Suspense } from "react";
import OAuthCallback from "@/components/campus/OAuthCallback";

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback provider="google" />
    </Suspense>
  );
}

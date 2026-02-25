"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ClipEditorRedirect() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/editor?clip=${id}`);
  }, [id, router]);

  return null;
}

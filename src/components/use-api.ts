"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!path) return;
    try { setError(""); setData(await api<T>(path)); }
    catch (e: any) { if (e.status === 401) window.location.href = "/admin/login"; else setError(e.message); }
  }, [path]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return { data, error, reload: load };
}

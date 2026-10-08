"use client";
import { useState } from "react";
import { api } from "@/components/ui";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/admin/login", { json: { email, password } }); window.location.href = "/admin"; }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={go} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
        <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" autoComplete="username" className="input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div><label className="label" htmlFor="p">Password</label><input id="p" type="password" autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}

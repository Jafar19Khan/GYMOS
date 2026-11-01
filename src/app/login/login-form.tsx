"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { error?: string; destination?: string };

      if (!response.ok || !result.destination) {
        setError(result.error || "Unable to sign in. Please try again.");
        return;
      }

      router.replace(result.destination);
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-bold text-white/70">Email address</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#171d19] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b6f36a]/70"
          placeholder="you@example.com" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-xs font-bold text-white/70">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128}
          value={password} onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#171d19] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b6f36a]/70"
          placeholder="Enter your password" />
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center rounded-full bg-[#b6f36a] px-5 py-4 text-sm font-black text-[#090b0a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

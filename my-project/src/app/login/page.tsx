"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Login failed" }));
        setError(msg || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 w-full flex flex-col lg:flex-row items-stretch bg-brand-bg-light text-slate-800 selection:bg-teal-100 selection:text-teal-900">
      {/* LEFT PANEL */}
      <div className="relative w-full lg:w-[54%] bg-slate-900 text-white p-8 lg:p-14 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgb(148, 163, 184) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-sky-400/5 blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold shadow-inner">
              <svg
                className="w-5 h-5 text-teal-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block leading-snug">
                EventOps
              </span>
              <p className="text-xs text-slate-400 font-normal">
                Event operations, connected.
              </p>
            </div>
          </div>
        </div>

        {/* Center visual */}
        <div className="relative z-10 my-auto py-8 max-w-lg mx-auto w-full flex flex-col justify-center">
          <div className="mb-10 text-left">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              Every event,
              <br />
              <span style={{ color: "#2dd4bf" }}>beautifully connected.</span>
            </h2>
            <p className="text-sm text-slate-300/80 mt-3 font-normal leading-relaxed max-w-md">
              One place for your people, operations and everything happening live.
            </p>
          </div>

          <div className="relative w-full h-64 flex items-center justify-center overflow-visible">
            <svg
              className="w-full h-full max-w-md pointer-events-none overflow-visible"
              viewBox="0 0 420 220"
              fill="none"
            >
              <path d="M 65 60 C 120 40, 160 85, 210 110" stroke="#2dd4bf" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" />
              <path d="M 100 170 C 145 180, 175 145, 210 110" stroke="#38bdf8" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
              <path d="M 345 55 C 295 45, 255 80, 210 110" stroke="#2dd4bf" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 4" strokeLinecap="round" />
              <path d="M 360 160 C 310 175, 260 140, 210 110" stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
              <path d="M 210 35 C 210 65, 210 85, 210 110" stroke="#2dd4bf" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round" />
              <path d="M 265 185 C 245 165, 225 135, 210 110" stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" strokeLinecap="round" />

              <circle cx="210" cy="110" r="34" fill="#0d9488" fillOpacity="0.08" />
              <circle cx="210" cy="110" r="18" fill="#14b8a6" fillOpacity="0.15" />

              <circle cx="210" cy="110" r="7" fill="#2dd4bf" />
              <circle cx="210" cy="110" r="2.5" fill="#0f172a" />

              <circle cx="65" cy="60" r="8" fill="#2dd4bf" fillOpacity="0.15" />
              <circle cx="65" cy="60" r="3" fill="#2dd4bf" />

              <circle cx="100" cy="170" r="9" fill="#38bdf8" fillOpacity="0.12" />
              <circle cx="100" cy="170" r="3.5" fill="#38bdf8" />

              <circle cx="210" cy="35" r="5" fill="#2dd4bf" fillOpacity="0.15" />
              <circle cx="210" cy="35" r="2" fill="#2dd4bf" />

              <circle cx="345" cy="55" r="7" fill="#2dd4bf" fillOpacity="0.15" />
              <circle cx="345" cy="55" r="2.5" fill="#5eead4" />

              <circle cx="360" cy="160" r="9" fill="#38bdf8" fillOpacity="0.12" />
              <circle cx="360" cy="160" r="3.5" fill="#38bdf8" />

              <circle cx="265" cy="185" r="6" fill="#f59e0b" fillOpacity="0.15" />
              <circle cx="265" cy="185" r="2" fill="#f59e0b" />
            </svg>
          </div>
        </div>

        {/* Bottom text */}
        <div className="relative z-10 pt-4 border-t border-slate-800/60">
          <p className="text-xs text-slate-400/90 font-normal tracking-wide">
            Attendees <span className="text-slate-600 mx-1">·</span> Volunteers{" "}
            <span className="text-slate-600 mx-1">·</span> Organizers
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-[46%] bg-white flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        {/* Top aux nav */}
        <div className="flex items-center justify-between">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
              EO
            </div>
            <span className="font-bold text-slate-900 tracking-tight">EventOps</span>
          </div>
          <div className="ml-auto text-xs text-slate-500 font-medium">
            New here?
            <a href="/signup" className="text-teal-700 font-semibold hover:underline ml-1">
              Create an account →
            </a>
          </div>
        </div>

        {/* Auth card */}
        <div className="my-auto max-w-sm w-full mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back.
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Sign in to continue to your event operations workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                id="email"
                placeholder="alex.vance@eventops.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all shadow-sm"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all shadow-sm pr-10"
                  required
                />
                <button
                  type="button"
                  aria-label="Show password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center pt-1">
              <input
                id="remember_me"
                name="remember_me"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 cursor-pointer"
              />
              <label htmlFor="remember_me" className="ml-2 block text-xs font-medium text-slate-600 cursor-pointer select-none">
                Remember this device for 30 days
              </label>
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow hover:shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <span>{loading ? "Signing in…" : "Sign in"}</span>
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Dev seed logins (password: <span className="font-mono normal-case">password123</span>)
              </p>
              <div className="space-y-1">
                {[
                  { email: "organiser@eventops.com", label: "Organiser" },
                  { email: "volunteer@eventops.com", label: "Volunteer · Team Lead" },
                  { email: "attendee@eventops.com", label: "Attendee" },
                ].map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    onClick={() => {
                      setEmail(s.email);
                      setPassword("password123");
                    }}
                    className="w-full flex items-center justify-between text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="font-mono text-slate-400">{s.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* SSO / Event Code */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="bg-brand-bg-subtle/70 border border-slate-200/80 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-600 mb-2">
                Joining with a volunteer pass or quick code?
              </p>
              <button className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Enter Event Access Pass / QR
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>© 2026 EventOps Technologies Inc.</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-600 hover:underline">Privacy</a>
            <a href="#" className="hover:text-slate-600 hover:underline">Terms</a>
            <a href="#" className="hover:text-slate-600 hover:underline">Help &amp; Docs</a>
          </div>
        </div>
      </div>
    </main>
  );
}

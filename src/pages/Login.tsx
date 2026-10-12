import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../domain/authStore";
import { Mark } from "../ui/Page";

const ease = [0.22, 1, 0.36, 1] as const;

export function Login() {
  const { ready, authenticated, configured, login } = useAuth();
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && authenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await login(loginId, password);
    setBusy(false);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 15% 20%, rgb(20 82 62 / 0.14) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 90% 80%, rgb(31 90 102 / 0.12) 0%, transparent 50%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="w-full max-w-md border border-ink/20 bg-wash/80 px-6 py-8 backdrop-blur-sm sm:px-10 sm:py-10"
      >
        <div className="flex flex-wrap items-end justify-center gap-1 sm:gap-1.5">
          <p className="brand text-[clamp(3.25rem,14vw,4.75rem)] leading-none text-ink">PH</p>
          <img
            src="/logo.png?v=3"
            alt=""
            width={96}
            height={96}
            className="-ml-1 mb-[0.12em] h-[clamp(2.75rem,10vw,3.75rem)] w-auto shrink-0 select-none"
            decoding="async"
          />
        </div>

        <div className="mx-auto mt-4 flex max-w-[12rem] items-center gap-3">
          <Mark tone="pine" />
          <span className="sep-line flex-1" />
          <Mark tone="soft" />
        </div>

        <p className="mt-5 text-center text-sm leading-relaxed text-ink/55">
          Painel privado. Entra para continuar.
        </p>

        <div className="mt-8 border-t border-ink/10 pt-7">
          {!ready ? (
            <p className="text-center text-sm text-ink/45">A verificar sessão…</p>
          ) : !configured ? (
            <p className="text-center text-sm leading-relaxed text-ink/55">
              Auth ainda não está configurada no servidor. Define{" "}
              <span className="num text-ink/70">AUTH_*</span> no ambiente.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <label className="block">
                <span className="eyebrow text-ink/40">Nome ou email</span>
                <input
                  className="mt-2 w-full border-b border-ink/25 bg-transparent py-2.5 font-display text-xl tracking-tight text-ink outline-none transition-[border-color] placeholder:text-ink/25 focus:border-ink"
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Xavier Emanuel"
                  required
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="eyebrow text-ink/40">Senha</span>
                <input
                  className="mt-2 w-full border-b border-ink/25 bg-transparent py-2.5 text-base tracking-wide text-ink outline-none transition-[border-color] placeholder:text-ink/25 focus:border-ink"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {err ? (
                <p className="flex items-center gap-2 text-sm text-rust" role="alert">
                  <Mark tone="rust" />
                  {err}
                </p>
              ) : null}

              <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-between">
                <button
                  type="submit"
                  className="btn-solid min-h-12 w-full px-8 text-[0.72rem] uppercase tracking-[0.16em] disabled:opacity-40 sm:w-auto"
                  disabled={busy || !loginId.trim() || !password}
                >
                  {busy ? "A entrar…" : "Entrar"}
                </button>
                <span className="text-[0.68rem] uppercase tracking-[0.14em] text-ink/30">
                  Sessão · 14 dias
                </span>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

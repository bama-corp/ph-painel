import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../domain/labels";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import { AssistenteFab } from "../pages/Assistente";

function SyncBadge() {
  const { syncStatus, syncError, pushNow, ready } = useStore();
  if (!ready) return <span className="text-ink/35">A carregar BD…</span>;
  const label =
    syncStatus === "synced"
      ? "Neon · sync"
      : syncStatus === "saving"
        ? "A gravar…"
        : syncStatus === "loading"
          ? "A carregar…"
          : syncStatus === "offline"
            ? "Offline (local)"
            : "Erro sync";
  return (
    <button
      type="button"
      title={syncError ?? "Clica para forçar gravação na BD"}
      onClick={() => void pushNow()}
      className={`min-h-10 tracking-wide sm:min-h-0 ${
        syncStatus === "error" || syncStatus === "offline" ? "text-rust" : "hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state, setMonth, reset } = useStore();
  const home = pathname === "/";
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const active = navRef.current?.querySelector(".nav-link-active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <header className="px-4 pt-5 sm:px-12 sm:pt-8 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4">
            {home ? (
              <span className="eyebrow">Painel financeiro</span>
            ) : (
              <NavLink
                to="/"
                className="brand inline-flex items-end gap-0.5 text-[1.85rem] text-ink transition-opacity hover:opacity-70 sm:-ml-0.5 sm:gap-1 sm:text-[2.35rem]"
              >
                <span>PH</span>
                <img
                  src="/logo.png?v=3"
                  alt=""
                  width={48}
                  height={48}
                  className="-ml-0.5 mb-[0.08em] h-[1.05em] w-auto shrink-0 select-none"
                  decoding="async"
                />
              </NavLink>
            )}
            <label className="flex shrink-0 items-center gap-2 text-[0.72rem] text-ink/40 sm:hidden">
              <span className="uppercase tracking-[0.16em]">Mês</span>
              <input
                type="month"
                value={state.month}
                onChange={(e) => setMonth(e.target.value)}
                className="max-w-[9.5rem] border-b border-rule/60 bg-transparent py-1 text-base outline-none focus:border-ink sm:text-sm"
              />
            </label>
          </div>

          <nav
            ref={navRef}
            className="shell-nav mt-4 sm:mt-5"
            aria-label="Secções do painel"
          >
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link")}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mx-auto mt-4 flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6 sm:gap-y-3">
          <span className="mark hidden sm:inline-block" aria-hidden />
          <span className="sep-line hidden min-w-[3rem] flex-1 sm:block" />
          <p className="w-full text-[0.75rem] leading-snug text-ink/45 sm:w-auto sm:text-[0.78rem]">
            {home
              ? "Pessoal + quatro empresas. Um painel."
              : `Cinco caixas · ${monthLabel(state.month)}`}
          </p>
          <span className="sep-line hidden w-8 sm:block sm:flex-none" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-ink/40">
            <label className="hidden items-center gap-2 sm:flex">
              <span className="uppercase tracking-[0.16em]">Mês</span>
              <input
                type="month"
                value={state.month}
                onChange={(e) => setMonth(e.target.value)}
                className="border-b border-rule/60 bg-transparent py-0.5 outline-none focus:border-ink"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Repor ao snapshot do seed (19/08/2026)? Os dados deste browser são apagados e a BD será actualizada. Exporta JSON no Caderno se quiseres guardar.",
                  )
                ) {
                  reset();
                }
              }}
              className="min-h-10 tracking-wide hover:text-ink sm:min-h-0"
            >
              Repor seed
            </button>
            <SyncBadge />
          </div>
          <span className="mark mark-soft hidden sm:inline-block" aria-hidden />
        </div>
      </header>

      <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-12 sm:pb-24 sm:pt-10 lg:px-16">
        {children}
      </main>
      <AssistenteFab />
    </div>
  );
}

import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../domain/labels";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";

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
      className={`tracking-wide ${syncStatus === "error" || syncStatus === "offline" ? "text-rust" : "hover:text-ink"}`}
    >
      {label}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state, setMonth, reset } = useStore();
  const home = pathname === "/";

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-6 sm:px-12 sm:pt-8 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-4">
          {home ? (
            <span className="eyebrow">Painel financeiro</span>
          ) : (
            <NavLink
              to="/"
              className="brand inline-flex items-end gap-0.5 text-[2rem] text-ink transition-opacity hover:opacity-70 sm:-ml-0.5 sm:gap-1 sm:text-[2.35rem]"
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
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
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

        <div className="mx-auto mt-6 flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3">
          <span className="mark" aria-hidden />
          <span className="sep-line min-w-[3rem] flex-1" />
          <p className="text-[0.78rem] text-ink/45">
            {home
              ? "Pessoal + quatro empresas. Um painel."
              : `Cinco caixas · ${monthLabel(state.month)}`}
          </p>
          <span className="sep-line hidden w-8 sm:block sm:flex-none" />
          <div className="flex flex-wrap items-center gap-4 text-[0.72rem] text-ink/40">
            <label className="flex items-center gap-2">
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
              className="tracking-wide hover:text-ink"
            >
              Repor seed
            </button>
            <SyncBadge />
          </div>
          <span className="mark mark-soft" aria-hidden />
        </div>
      </header>

      <main className="px-6 pb-20 pt-8 sm:px-12 sm:pb-24 sm:pt-10 lg:px-16">{children}</main>
    </div>
  );
}

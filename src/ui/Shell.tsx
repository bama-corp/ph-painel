import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useStore } from "../domain/store";
import { monthLabel } from "../domain/money";

const LINKS = [
  { to: "/", label: "Eu" },
  { to: "/orcamento", label: "Orçamento" },
  { to: "/contas", label: "Contas" },
  { to: "/pds", label: "PDS" },
  { to: "/plural", label: "Plural" },
  { to: "/picasso", label: "Picasso's" },
  { to: "/ph", label: "PH" },
  { to: "/movimentos", label: "Registo" },
  { to: "/decisao", label: "Decisão" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { state, setMonth, reset } = useStore();
  const home = pathname === "/";

  return (
    <div className="min-h-screen">
      <header className="px-5 pt-6 sm:px-10 sm:pt-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 gap-y-4">
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
            {LINKS.map((l) => (
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

        <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3">
          <span className="mark" aria-hidden />
          <span className="sep-line min-w-[3rem] flex-1" />
          <p className="text-[0.78rem] text-ink/45">
            {home ? "Três entidades. Um painel." : `Três entidades · ${monthLabel(state.month)}`}
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
            <button type="button" onClick={reset} className="tracking-wide hover:text-ink">
              Repor
            </button>
          </div>
          <span className="mark mark-soft" aria-hidden />
        </div>
      </header>

      <main className="px-5 pb-20 pt-8 sm:px-10 sm:pb-24 sm:pt-10">{children}</main>
    </div>
  );
}

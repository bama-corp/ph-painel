import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import { openCount, TASK_ALERTS_NAV, TASK_CALENDAR_NAV, TASK_NAV, TASK_ROUTINE_NAV, TASK_SYSTEM_NAV } from "../domain/tasks";
import { useTasks } from "../domain/tasksStore";
import { FloatingPomodoro } from "./FloatingPomodoro";

export function TasksShell({ children }: { children?: ReactNode }) {
  const { tasks, syncStatus, syncError, pushNow } = useTasks();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const active = navRef.current?.querySelector(".nav-link-active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  const syncLabel =
    syncStatus === "synced"
      ? "Neon · sync"
      : syncStatus === "saving"
        ? "A gravar…"
        : syncStatus === "loading"
          ? "A carregar…"
          : syncStatus === "local"
            ? "Só local (sem TASKS_DATABASE_URL)"
            : syncStatus === "offline"
              ? "Offline (cache local)"
              : "Erro sync";

  return (
    <div className="min-h-screen">
      <header className="px-4 pt-5 sm:px-12 sm:pt-8 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <NavLink
              to="/"
              className="brand inline-flex items-end gap-0.5 text-[1.85rem] text-ink transition-opacity hover:opacity-70 sm:-ml-0.5 sm:gap-1 sm:text-[2.35rem]"
              title="Voltar ao hub"
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
            <span className="eyebrow mb-1.5">Tarefas</span>
          </div>

          <nav
            ref={navRef}
            className="shell-nav mt-4 sm:mt-5"
            aria-label="Âmbito das tarefas"
          >
            {TASK_NAV.map((l) => {
              const n = openCount(tasks, l.entityId);
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/tarefas"}
                  className={({ isActive }) =>
                    isActive ? "nav-link nav-link-active" : "nav-link"
                  }
                >
                  {l.label}
                  {n > 0 ? (
                    <span className="ml-1.5 num text-[0.65rem] text-ink/35">{n}</span>
                  ) : null}
                </NavLink>
              );
            })}
            <NavLink
              to={TASK_CALENDAR_NAV.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {TASK_CALENDAR_NAV.label}
            </NavLink>
            <NavLink
              to={TASK_ROUTINE_NAV.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {TASK_ROUTINE_NAV.label}
            </NavLink>
            <NavLink
              to={TASK_ALERTS_NAV.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {TASK_ALERTS_NAV.label}
            </NavLink>
            <NavLink
              to={TASK_SYSTEM_NAV.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {TASK_SYSTEM_NAV.label}
            </NavLink>
          </nav>
        </div>

        <div className="mx-auto mt-4 flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6">
          <span className="mark hidden sm:inline-block" aria-hidden />
          <span className="sep-line hidden min-w-[3rem] flex-1 sm:block" />
          <p className="text-[0.75rem] leading-snug text-ink/45 sm:text-[0.78rem]">
            Minhas + {ENTITY.cw.short}, {ENTITY.rove.short}, {ENTITY.picasso.short},{" "}
            {ENTITY.ph.short}. BD Neon própria (separada das Finanças).
          </p>
          <button
            type="button"
            title={syncError || "Forçar gravação na BD de tarefas"}
            onClick={() => void pushNow()}
            className={`text-[0.72rem] tracking-wide ${
              syncStatus === "error" || syncStatus === "local" || syncStatus === "offline"
                ? "text-rust"
                : "text-ink/40 hover:text-ink"
            }`}
          >
            {syncLabel}
          </button>
          <span className="mark mark-soft hidden sm:inline-block" aria-hidden />
        </div>
        {syncError ? (
          <p className="mx-auto mt-2 max-w-7xl text-sm text-rust" role="status">
            Sync: {syncError}
            {syncStatus === "error" || syncStatus === "offline" ? (
              <>
                {" "}
                <button
                  type="button"
                  className="border-b border-rust/40 pb-px hover:border-rust"
                  onClick={() => void pushNow()}
                >
                  Tentar outra vez
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      <main className="px-4 pb-20 pt-6 sm:px-12 sm:pb-24 sm:pt-10 lg:px-16">
        {children ?? <Outlet />}
      </main>

      <FloatingPomodoro />
    </div>
  );
}

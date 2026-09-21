import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Mark } from "../ui/Page";

const MODULES = [
  {
    to: "/eu",
    title: "Finanças",
    line: "De quem é o dinheiro.",
    hint: "Pessoal + quatro empresas. Um painel.",
    tone: "pine" as const,
  },
  {
    to: "/tarefas",
    title: "Tarefas",
    line: "O que fazer a seguir.",
    hint: "Prioridades e acompanhamento.",
    tone: "soft" as const,
  },
] as const;

export function Hub() {
  return (
    <div className="flex min-h-screen flex-col px-4 pb-16 pt-8 sm:px-12 sm:pt-12 lg:px-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center"
      >
        <div className="flex flex-wrap items-end gap-1 sm:gap-1.5">
          <p className="brand text-[clamp(4.5rem,18vw,8.5rem)] text-ink">PH</p>
          <img
            src="/logo.png?v=3"
            alt=""
            width={140}
            height={140}
            className="-ml-1 mb-[0.15em] h-[clamp(3.5rem,12vw,6rem)] w-auto shrink-0 select-none"
            decoding="async"
          />
        </div>

        <div className="mt-4 flex max-w-md items-center gap-3">
          <Mark />
          <span className="sep-line flex-1" />
        </div>

        <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-ink/60">
          Escolhe o módulo.
        </p>

        <nav
          className="mt-12 grid gap-0 border-t border-ink/15 sm:grid-cols-2 sm:gap-0"
          aria-label="Módulos"
        >
          {MODULES.map((m, i) => (
            <Link
              key={m.to}
              to={m.to}
              className={`group block border-b border-ink/15 py-8 transition-colors hover:bg-wash/40 sm:py-10 ${
                i === 0 ? "sm:border-r sm:pr-10" : "sm:pl-10"
              }`}
            >
              <p className="eyebrow flex items-center gap-2">
                <Mark tone={m.tone} />
                Módulo
              </p>
              <h2 className="mt-3 font-display text-[1.85rem] font-semibold tracking-tight text-ink sm:text-[2.1rem]">
                {m.title}
              </h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/70">{m.line}</p>
              <p className="mt-1.5 text-sm text-ink/40">{m.hint}</p>
              <span className="mt-5 inline-block text-[0.72rem] uppercase tracking-[0.16em] text-ink/35 transition-colors group-hover:text-ink">
                Entrar →
              </span>
            </Link>
          ))}
        </nav>
      </motion.div>
    </div>
  );
}

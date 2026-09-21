import { Link } from "react-router-dom";
import {
  COMBO_PH,
  COMO_ESCOLHER,
  METODOS,
  SISTEMA_PASSOS,
} from "../domain/tarefasSistema";
import { Mark, PageHeader, Sep } from "../ui/Page";

export function TarefasSistema() {
  return (
    <div className="page">
      <PageHeader title="Sistema" mark="pine">
        O que fazer, quando e com que foco. Os métodos abaixo alimentam Minhas e as
        empresas — não precisas de os aplicar todos.
      </PageHeader>

      <p className="mt-8 max-w-2xl text-[0.95rem] leading-relaxed text-ink/65">{COMBO_PH}</p>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="pine" />
          <h2 className="section-title">Métodos</h2>
        </div>
        <p className="mt-2 text-sm text-ink/45">Uma linha por método — o essencial.</p>
        <ul className="mt-6">
          {METODOS.map((m) => (
            <li key={m.id} className="border-b border-ink/[0.07] py-4 first:pt-0">
              <p className="font-display text-[1.05rem] font-semibold tracking-tight">{m.nome}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{m.como}</p>
              <p className="mt-2 text-[0.72rem] uppercase tracking-[0.12em] text-ink/35">
                Quando · {m.uso}
                <span className="mx-2 text-ink/20">·</span>
                Onde · {m.onde}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Sep />

      <section>
        <div className="section-head">
          <Mark />
          <h2 className="section-title">Como escolher</h2>
        </div>
        <ul className="mt-5">
          {COMO_ESCOLHER.map((c) => (
            <li
              key={c.quando}
              className="flex flex-col gap-0.5 border-b border-ink/[0.07] py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <span className="text-sm text-ink/60">{c.quando}</span>
              <span className="shrink-0 font-display text-[0.95rem] tracking-tight text-ink">
                {c.metodo}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="soft" />
          <h2 className="section-title">Começar hoje</h2>
        </div>
        <ol className="mt-5">
          {SISTEMA_PASSOS.map((step, i) => (
            <li key={step} className="flex gap-3 border-b border-ink/[0.07] py-3.5 first:pt-0">
              <span className="num shrink-0 w-6 text-ink/35">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm leading-relaxed text-ink/70">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-ink/50">
          <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
            Abrir Minhas
          </Link>
          {" · "}
          Revisão → Dia → Matriz → Kanban.
        </p>
      </section>
    </div>
  );
}

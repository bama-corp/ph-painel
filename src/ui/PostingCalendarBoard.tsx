import { useMemo, useState } from "react";
import { formatDatePt } from "../domain/money";
import {
  CONTENT_PILLARS,
  POSITIONING,
  POST_PLATFORM_LABEL,
  POST_PLATFORMS,
  WEEKLY_POST_PLAN,
  addDaysYmd,
  doneKey,
  loadPostingDone,
  mondayOfWeek,
  planForWeekday,
  templateForWeekday,
  togglePostingDone,
  weekDatesFromMonday,
  type PostDayPlan,
  type PostPlatform,
} from "../domain/postingCalendar";
import {
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  isoWeekday,
  todayYmd,
  type Weekday,
} from "../domain/routines";
import { Mark, type MarkTone } from "./Page";

const PLATFORM_TONE: Record<PostPlatform, MarkTone> = {
  linkedin: "pine",
  instagram: "copper",
  whatsapp: "moss",
  github: "ink",
  youtube: "soft",
};

const PLATFORM_SHORT: Record<PostPlatform, string> = {
  linkedin: "LI",
  instagram: "IG",
  whatsapp: "WA",
  github: "GH",
  youtube: "YT",
};

type Focus =
  | { kind: "day"; weekday: Weekday; ymd: string }
  | { kind: "pillars" }
  | { kind: "platforms" };

const MIN_PLAN = [
  { id: "linkedin" as const, label: "LinkedIn", target: 3, hint: "posts fortes" },
  { id: "instagram" as const, label: "Instagram", target: 2, hint: "peças visuais" },
  { id: "whatsapp" as const, label: "WhatsApp", target: 3, hint: "Estados" },
];

export function PostingCalendarBoard() {
  const today = todayYmd();
  const [monday, setMonday] = useState(() => mondayOfWeek(today));
  const [done, setDone] = useState(() => loadPostingDone());
  const [focus, setFocus] = useState<Focus>(() => ({
    kind: "day",
    weekday: isoWeekday(),
    ymd: today,
  }));
  const [showModel, setShowModel] = useState(false);
  const [copied, setCopied] = useState(false);

  const days = useMemo(() => weekDatesFromMonday(monday), [monday]);
  const weekLabel = `${formatDatePt(monday)} – ${formatDatePt(addDaysYmd(monday, 6))}`;

  const focusPlan: PostDayPlan | null =
    focus.kind === "day" ? planForWeekday(focus.weekday) : null;
  const focusTemplate = focus.kind === "day" ? templateForWeekday(focus.weekday) : null;

  function shiftWeek(delta: number) {
    setMonday((m) => addDaysYmd(m, delta * 7));
  }

  function onToggle(ymd: string, platform: PostPlatform) {
    setDone((cur) => togglePostingDone(cur, doneKey(ymd, platform)));
  }

  function selectDay(weekday: Weekday, ymd: string) {
    setFocus({ kind: "day", weekday, ymd });
    setShowModel(false);
    setCopied(false);
  }

  async function copyModel() {
    if (!focusTemplate?.body) return;
    try {
      await navigator.clipboard.writeText(focusTemplate.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const weekDone = useMemo(() => {
    let n = 0;
    let total = 0;
    const byPlatform: Record<"linkedin" | "instagram" | "whatsapp", number> = {
      linkedin: 0,
      instagram: 0,
      whatsapp: 0,
    };
    for (const { weekday, ymd } of days) {
      const plan = planForWeekday(weekday);
      for (const s of plan.slots) {
        if (s.optional) continue;
        total += 1;
        if (done.has(doneKey(ymd, s.platform))) {
          n += 1;
          if (s.platform in byPlatform) {
            byPlatform[s.platform as keyof typeof byPlatform] += 1;
          }
        }
      }
    }
    return { n, total, byPlatform };
  }, [days, done]);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="copper" />
            Calendário · postagem
          </p>
          <p className="mt-2 text-sm leading-snug text-ink/50">
            LinkedIn · Instagram · WhatsApp — hora de Luanda. Uma demo vira Reel, Estado e post.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 border border-ink/12 bg-wash/40 p-1">
          <button
            type="button"
            className="min-h-9 px-2.5 text-xs uppercase tracking-[0.12em] text-ink/45 hover:text-ink"
            onClick={() => shiftWeek(-1)}
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <p className="min-w-[11rem] text-center font-display text-[0.95rem] tracking-tight tabular-nums">
            {weekLabel}
          </p>
          <button
            type="button"
            className="min-h-9 px-2.5 text-xs uppercase tracking-[0.12em] text-ink/45 hover:text-ink"
            onClick={() => shiftWeek(1)}
            aria-label="Semana seguinte"
          >
            ›
          </button>
          <span className="mx-1 h-4 w-px bg-ink/15" aria-hidden />
          <button
            type="button"
            className="min-h-9 px-2.5 text-[0.65rem] uppercase tracking-[0.12em] text-ink/45 hover:text-ink"
            onClick={() => {
              const t = todayYmd();
              setMonday(mondayOfWeek(t));
              selectDay(isoWeekday(), t);
            }}
          >
            Hoje
          </button>
          <span className="num px-2 text-[0.7rem] text-ink/35">
            {weekDone.n}/{weekDone.total}
          </span>
        </div>
      </div>

      <p className="mt-4 border-l-2 border-copper/50 pl-3 text-sm leading-relaxed text-ink/60">
        {POSITIONING}
      </p>

      {/* Semana compacta */}
      <div className="mt-6 border border-ink/12">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-wash/35">
          {days.map(({ weekday, ymd }) => {
            const isToday = ymd === today;
            const isFocus = focus.kind === "day" && focus.ymd === ymd;
            return (
              <button
                key={`h-${ymd}`}
                type="button"
                onClick={() => selectDay(weekday, ymd)}
                className={`border-r border-ink/10 py-2 text-center last:border-r-0 ${
                  isFocus ? "bg-wash/70" : "hover:bg-wash/40"
                }`}
              >
                <p className="text-[0.6rem] uppercase tracking-[0.14em] text-ink/35">
                  {WEEKDAY_SHORT[weekday]}
                </p>
                <p
                  className={`num mt-0.5 text-sm ${
                    isToday ? "text-pine" : isFocus ? "text-ink" : "text-ink/55"
                  }`}
                >
                  {Number(ymd.slice(8))}
                </p>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
          {days.map(({ weekday, ymd }) => {
            const plan = WEEKLY_POST_PLAN[weekday];
            const isToday = ymd === today;
            const isFocus = focus.kind === "day" && focus.ymd === ymd;
            const doneCount = plan.slots.filter(
              (s) => !s.optional && done.has(doneKey(ymd, s.platform)),
            ).length;
            const required = plan.slots.filter((s) => !s.optional).length;
            const allDone = required > 0 && doneCount === required;

            return (
              <button
                key={ymd}
                type="button"
                onClick={() => selectDay(weekday, ymd)}
                className={`relative border-b border-r border-ink/10 px-2.5 py-3 text-left last:border-r-0 sm:min-h-[9.5rem] ${
                  isFocus ? "bg-wash/55" : "hover:bg-wash/30"
                }`}
              >
                {isFocus ? (
                  <span
                    className="absolute inset-x-0 top-0 h-0.5 bg-copper"
                    aria-hidden
                  />
                ) : isToday ? (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-pine/50" aria-hidden />
                ) : null}
                <p className="font-display text-[0.88rem] leading-snug tracking-tight text-ink/90">
                  {plan.theme}
                </p>
                <p className="mt-1.5 inline-block bg-ink/[0.06] px-1.5 py-0.5 num text-[0.62rem] text-ink/50">
                  {plan.time}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {plan.slots.map((s) => {
                    const isDone = done.has(doneKey(ymd, s.platform));
                    return (
                      <span
                        key={s.platform}
                        title={`${POST_PLATFORM_LABEL[s.platform]}${s.optional ? " (opc.)" : ""}`}
                        className={`num inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.08em] ${
                          isDone
                            ? "border-pine/35 bg-pine/10 text-pine"
                            : s.optional
                              ? "border-ink/10 text-ink/30"
                              : "border-ink/15 text-ink/55"
                        }`}
                      >
                        <Mark tone={isDone ? "pine" : PLATFORM_TONE[s.platform]} />
                        {PLATFORM_SHORT[s.platform]}
                      </span>
                    );
                  })}
                </div>
                <p
                  className={`mt-3 num text-[0.62rem] ${
                    allDone ? "text-pine" : "text-ink/30"
                  }`}
                >
                  {doneCount}/{required}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 text-[0.65rem] uppercase tracking-[0.12em]" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={focus.kind === "day"}
                className={`min-h-9 px-2 ${
                  focus.kind === "day" ? "border-b border-ink text-ink" : "text-ink/40 hover:text-ink"
                }`}
                onClick={() => {
                  if (focus.kind !== "day") {
                    selectDay(isoWeekday(), todayYmd());
                  }
                }}
              >
                Dia
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={focus.kind === "platforms"}
                className={`min-h-9 px-2 ${
                  focus.kind === "platforms"
                    ? "border-b border-ink text-ink"
                    : "text-ink/40 hover:text-ink"
                }`}
                onClick={() => setFocus({ kind: "platforms" })}
              >
                Redes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={focus.kind === "pillars"}
                className={`min-h-9 px-2 ${
                  focus.kind === "pillars"
                    ? "border-b border-ink text-ink"
                    : "text-ink/40 hover:text-ink"
                }`}
                onClick={() => setFocus({ kind: "pillars" })}
              >
                Pilares
              </button>
            </div>
          </div>

          {focus.kind === "day" && focusPlan ? (
            <div className="border border-ink/15 bg-wash/35 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow flex items-center gap-2">
                    <Mark tone="copper" />
                    {WEEKDAY_LABEL[focus.weekday]}
                    <span className="num text-ink/30">{formatDatePt(focus.ymd)}</span>
                  </p>
                  <h2 className="mt-2 font-display text-xl tracking-tight sm:text-2xl">
                    {focusPlan.theme}
                  </h2>
                  <p className="mt-1 text-sm text-ink/45">
                    Publicar por volta das{" "}
                    <span className="num text-ink/65">{focusPlan.time}</span>
                  </p>
                </div>
              </div>

              <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                {focusPlan.slots.map((s) => {
                  const key = doneKey(focus.ymd, s.platform);
                  const isDone = done.has(key);
                  return (
                    <li
                      key={s.platform}
                      className={`flex flex-col border px-3 py-3 ${
                        isDone ? "border-pine/30 bg-pine/[0.06]" : "border-ink/12 bg-paper/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm text-ink/85">
                          <Mark tone={PLATFORM_TONE[s.platform]} />
                          {POST_PLATFORM_LABEL[s.platform]}
                        </p>
                        {s.optional ? (
                          <span className="text-[0.58rem] uppercase tracking-[0.1em] text-ink/35">
                            opc.
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 flex-1 text-[0.8rem] leading-snug text-ink/55">{s.format}</p>
                      <button
                        type="button"
                        className={`mt-3 min-h-9 border text-[0.65rem] uppercase tracking-[0.12em] transition-colors ${
                          isDone
                            ? "border-pine/40 text-pine hover:bg-pine/10"
                            : "border-ink/20 text-ink/50 hover:border-ink/40 hover:text-ink"
                        }`}
                        onClick={() => onToggle(focus.ymd, s.platform)}
                      >
                        {isDone ? "Feito ✓" : "Marcar feito"}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {focusTemplate ? (
                <div className="mt-5 border-t border-ink/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow flex items-center gap-2">
                      <Mark tone="pine" />
                      Modelo · {POST_PLATFORM_LABEL[focusTemplate.platform]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-9 px-2 text-[0.65rem] uppercase tracking-[0.12em] text-ink/45 hover:text-ink"
                        onClick={() => setShowModel((v) => !v)}
                      >
                        {showModel ? "Ocultar" : "Ver texto"}
                      </button>
                      {showModel ? (
                        <button
                          type="button"
                          className="btn-ghost !min-h-9 py-1 text-[0.65rem]"
                          onClick={() => void copyModel()}
                        >
                          {copied ? "Copiado" : "Copiar"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{focusTemplate.title}</p>
                  {showModel ? (
                    <>
                      <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap border border-ink/10 bg-wash/50 px-3 py-3 font-sans text-sm leading-relaxed text-ink/60">
                        {focusTemplate.body}
                      </pre>
                      {focusTemplate.checklist?.length ? (
                        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink/55">
                          {focusTemplate.checklist.map((c) => (
                            <li key={c} className="flex gap-2">
                              <Mark tone="soft" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {focus.weekday === 0 ? (
                        <p className="mt-3 text-[0.72rem] text-ink/40">
                          Formato: texto com fotografia profissional ou imagem simples.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-[0.72rem] text-ink/40">
                      Texto de partida recolhido — abre quando fores publicar.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {focus.kind === "platforms" ? (
            <div className="border border-ink/15 bg-wash/35 px-4 py-4">
              <p className="eyebrow flex items-center gap-2">
                <Mark tone="pine" />
                Redes prioritárias
              </p>
              <p className="mt-2 text-sm text-ink/45">
                Nos primeiros 30 dias: LinkedIn, Instagram e WhatsApp. GitHub como portefólio;
                Shorts a partir dos melhores Reels.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {POST_PLATFORMS.map((p) => (
                  <li key={p.id} className="border border-ink/10 px-3 py-3">
                    <p className="flex items-center gap-2 text-sm text-ink/85">
                      <Mark tone={PLATFORM_TONE[p.id]} />
                      {p.label}
                      <span className="text-[0.6rem] uppercase tracking-[0.1em] text-ink/35">
                        {p.priority}
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm text-ink/55">{p.objective}</p>
                    <p className="mt-2 num text-[0.65rem] text-ink/35">{p.frequency}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {focus.kind === "pillars" ? (
            <div className="border border-ink/15 bg-wash/35 px-4 py-4">
              <p className="eyebrow flex items-center gap-2">
                <Mark tone="moss" />
                Pilares de conteúdo
              </p>
              <p className="mt-2 text-sm text-ink/45">Orientação editorial — não fórmula rígida.</p>
              <ul className="mt-4 flex flex-col gap-3">
                {CONTENT_PILLARS.map((p) => (
                  <li key={p.id} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-ink/[0.07] pb-3 last:border-0">
                    <p className="num text-lg text-ink/35">{p.pct}%</p>
                    <div>
                      <p className="text-sm text-ink/85">{p.title}</p>
                      <p className="mt-1 text-sm text-ink/55">{p.themes}</p>
                      <p className="mt-1 text-[0.8rem] italic text-ink/40">«{p.example}»</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="border border-ink/15 bg-wash/30 px-3.5 py-3.5">
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="pine" />
              Plano mínimo
              <span className="num text-ink/30">semana</span>
            </p>
            <ul className="mt-4 flex flex-col gap-3.5">
              {MIN_PLAN.map((row) => {
                const count = weekDone.byPlatform[row.id];
                const ok = count >= row.target;
                const pct = Math.min(100, Math.round((count / row.target) * 100));
                return (
                  <li key={row.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm text-ink/80">
                        <Mark tone={PLATFORM_TONE[row.id]} />
                        {row.label}
                      </p>
                      <p className={`num text-[0.75rem] ${ok ? "text-pine" : "text-ink/40"}`}>
                        {count}
                        <span className="text-ink/25">/{row.target}</span>
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-ink/[0.07]">
                      <div
                        className={`h-full transition-[width] duration-300 ${
                          ok ? "bg-pine" : "bg-ink/40"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[0.65rem] text-ink/40">{row.hint}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 border-t border-ink/10 pt-3 text-[0.72rem] leading-snug text-ink/45">
              Consistência &gt; estar em todas as redes todos os dias.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

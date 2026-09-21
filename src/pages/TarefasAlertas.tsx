import { useState } from "react";
import { Link } from "react-router-dom";
import {
  disableDeviceNotifications,
  enableDeviceNotifications,
  loadDeviceNotifyPrefs,
  notificationPermission,
  showDeviceNotification,
  triggerServerNotify,
} from "../domain/deviceNotify";
import { Mark, PageHeader, Sep } from "../ui/Page";

export function TarefasAlertas() {
  const [prefs, setPrefs] = useState(() => loadDeviceNotifyPrefs());
  const [perm, setPerm] = useState(() => notificationPermission());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onEnableDevice() {
    setMsg("");
    const r = await enableDeviceNotifications();
    setPerm(notificationPermission());
    setPrefs(loadDeviceNotifyPrefs());
    if (!r.ok) {
      setMsg(r.reason);
      return;
    }
    showDeviceNotification("PH Tarefas", "Notificações neste dispositivo activas.");
    setMsg("Browser OK — vais ver alertas aqui (ex. fim do Pomodoro).");
  }

  function onDisableDevice() {
    disableDeviceNotifications();
    setPrefs(loadDeviceNotifyPrefs());
    setMsg("Alertas neste dispositivo desactivados.");
  }

  async function onServer(mode: "test" | "digest" | "dry") {
    setBusy(true);
    setMsg("");
    const r = await triggerServerNotify(mode);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.reason);
      return;
    }
    if (mode === "dry" && r.text) {
      setMsg(`Pré-visualização:\n${r.text}`);
      return;
    }
    setMsg(
      mode === "test"
        ? `Teste enviado${r.via ? ` via ${r.via}` : ""}. Vê o telemóvel.`
        : `Digest enviado${r.via ? ` via ${r.via}` : ""}.`,
    );
  }

  return (
    <div className="page">
      <PageHeader title="Alertas" mark="pine">
        Notificações no telemóvel via{" "}
        <span className="font-medium text-ink">ntfy</span> — simples, grátis, sem WhatsApp.{" "}
        <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
          Minhas
        </Link>
      </PageHeader>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="pine" />
          <h2 className="section-title">Telemóvel · ntfy</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">
          Digest de tarefas (atrasadas, prazo hoje, «Hoje», inbox) chega ao telemóvel. Configuras
          uma vez no .env e na app.
        </p>
        <ol className="mt-5 max-w-2xl space-y-3 text-sm text-ink/70">
          <li className="flex gap-3 border-b border-ink/[0.07] pb-3">
            <span className="num shrink-0 w-6 text-ink/35">01</span>
            <span>
              Instala a app <span className="font-display text-ink">ntfy</span> (Android / iOS) ou
              abre{" "}
              <a
                href="https://ntfy.sh"
                target="_blank"
                rel="noreferrer"
                className="border-b border-ink/25 pb-px hover:border-ink"
              >
                ntfy.sh
              </a>
              .
            </span>
          </li>
          <li className="flex gap-3 border-b border-ink/[0.07] pb-3">
            <span className="num shrink-0 w-6 text-ink/35">02</span>
            <span>
              Subscreve um tópico <span className="font-medium text-ink">só teu</span> — nome longo
              e difícil de adivinhar (ex.{" "}
              <span className="num text-[0.8rem] text-ink/80">ph-x9k2m-tarefas-a7f3</span>). Na app:
              «Subscribe to topic».
            </span>
          </li>
          <li className="flex gap-3 border-b border-ink/[0.07] pb-3">
            <span className="num shrink-0 w-6 text-ink/35">03</span>
            <span>
              No ficheiro <span className="num text-ink/80">.env</span> (e na Vercel se estiver
              online):
              <br />
              <span className="num mt-1 inline-block text-[0.8rem] text-ink/80">
                NTFY_TOPIC=&quot;o-mesmo-topico&quot;
              </span>
              <br />
              <span className="num text-[0.8rem] text-ink/45">
                NTFY_SERVER=&quot;https://ntfy.sh&quot;
              </span>{" "}
              (opcional — é o default)
            </span>
          </li>
          <li className="flex gap-3 border-b border-ink/[0.07] pb-3">
            <span className="num shrink-0 w-6 text-ink/35">04</span>
            <span>
              Reinicia a API (<span className="num text-[0.8rem]">npm run dev:api</span> / deploy) e
              carrega em «Enviar teste» abaixo.
            </span>
          </li>
          <li className="flex gap-3 pb-1">
            <span className="num shrink-0 w-6 text-ink/35">05</span>
            <span>
              Cron diário 07:00: define{" "}
              <span className="num text-[0.8rem] text-ink/80">NOTIFY_SECRET</span> e na Vercel o
              mesmo valor em <span className="num text-[0.8rem] text-ink/80">CRON_SECRET</span>.
              Local: <span className="num text-[0.8rem] text-ink/80">npm run notify:tasks</span>.
            </span>
          </li>
        </ol>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-solid"
            disabled={busy}
            onClick={() => void onServer("test")}
          >
            Enviar teste
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void onServer("digest")}
          >
            Enviar digest agora
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void onServer("dry")}
          >
            Pré-visualizar
          </button>
        </div>
      </section>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="copper" />
          <h2 className="section-title">Neste dispositivo</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">
          Alertas do browser neste aparelho (ex. fim do Pomodoro). Independente do ntfy.
        </p>
        <p className="mt-2 text-[0.72rem] uppercase tracking-[0.12em] text-ink/35">
          Permissão · {perm}
          {prefs.enabled ? " · activas" : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {!prefs.enabled ? (
            <button type="button" className="btn-solid" onClick={() => void onEnableDevice()}>
              Activar neste aparelho
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  showDeviceNotification("PH Tarefas", "Teste local — sem ntfy.")
                }
              >
                Teste local
              </button>
              <button type="button" className="btn-ghost" onClick={onDisableDevice}>
                Desactivar
              </button>
            </>
          )}
        </div>
      </section>

      {msg ? (
        <p
          className="mt-8 max-w-2xl whitespace-pre-wrap border border-ink/12 bg-wash/40 px-3 py-3 text-sm text-ink/70"
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}

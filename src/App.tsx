import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Shell } from "./ui/Shell";
import { TasksShell } from "./ui/TasksShell";
import { PomodoroProvider } from "./domain/pomodoroStore";
import { TasksProvider } from "./domain/tasksStore";
import { Hub } from "./pages/Hub";
import { Tarefas } from "./pages/Tarefas";
import { TarefasAlertas } from "./pages/TarefasAlertas";
import { TarefasCalendario } from "./pages/TarefasCalendario";
import { TarefasSistema } from "./pages/TarefasSistema";
import { Eu } from "./pages/Eu";
import { Definicao } from "./pages/Definicao";
import { Orcamento } from "./pages/Orcamento";
import { Contas } from "./pages/Contas";
import { Cw } from "./pages/Cw";
import { Rove } from "./pages/Rove";
import { Movimentos } from "./pages/Movimentos";
import { Empresa } from "./pages/Empresa";
import { Decisao } from "./pages/Decisao";
import { Caderno } from "./pages/Caderno";

function FinanceLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function TasksLayout() {
  return (
    <TasksProvider>
      <PomodoroProvider>
        <TasksShell />
      </PomodoroProvider>
    </TasksProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />

      <Route path="/tarefas" element={<TasksLayout />}>
        <Route index element={<Tarefas />} />
        <Route path="calendario" element={<TarefasCalendario />} />
        <Route path="alertas" element={<TarefasAlertas />} />
        <Route path="sistema" element={<TarefasSistema />} />
        <Route path=":ambito" element={<Tarefas />} />
      </Route>

      <Route element={<FinanceLayout />}>
        <Route path="/eu" element={<Eu />} />
        <Route path="/definicao" element={<Definicao />} />
        <Route path="/orcamento" element={<Orcamento />} />
        <Route path="/contas" element={<Contas />} />
        <Route path="/pds" element={<Cw />} />
        <Route path="/plural" element={<Rove />} />
        <Route path="/picasso" element={<Empresa entity="picasso" />} />
        <Route path="/ph" element={<Empresa entity="ph" />} />
        <Route path="/cw" element={<Navigate to="/pds" replace />} />
        <Route path="/rove" element={<Navigate to="/plural" replace />} />
        <Route path="/movimentos" element={<Movimentos />} />
        <Route path="/decisao" element={<Decisao />} />
        <Route path="/caderno" element={<Caderno />} />
        <Route path="/assistente" element={<Navigate to="/eu" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

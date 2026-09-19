import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./ui/Shell";
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

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Eu />} />
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
        <Route path="/assistente" element={<Navigate to="/" replace />} />
        <Route path="/caderno" element={<Caderno />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

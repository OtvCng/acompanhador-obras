/**
 * Rotas. Dono: orquestrador. Cada página é dona de um terminal (ver docs/planejamento).
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import PainelPage from './pages/PainelPage';
import ObrasPage from './pages/ObrasPage';
import ObraDetalhePage from './pages/ObraDetalhePage';
import NovaObraPage from './pages/NovaObraPage';
import CampoPage from './pages/CampoPage';
import ModelosPage from './pages/ModelosPage';
import UsuariosPage from './pages/UsuariosPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PainelPage />} />
        <Route path="obras" element={<ObrasPage />} />
        <Route path="obras/nova" element={<NovaObraPage />} />
        <Route path="obras/:id" element={<ObraDetalhePage />} />
        <Route path="campo" element={<CampoPage />} />
        <Route path="campo/:obraId" element={<CampoPage />} />
        <Route path="modelos" element={<ModelosPage />} />
        <Route path="modelos/:tipo" element={<ModelosPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

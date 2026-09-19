import { Navigate, Route, Routes } from 'react-router-dom'

import FloatingTabBar from './components/FloatingTabBar'
import GradientBackdrop from './components/GradientBackdrop'
import AjoutManuel from './pages/AjoutManuel'
import ComposerPlat from './pages/ComposerPlat'
import Courses from './pages/Courses'
import Historique from './pages/Historique'
import Inventaire from './pages/Inventaire'
import Plats from './pages/Plats'
import Reglages from './pages/Reglages'
import Scan from './pages/Scan'

export default function App() {
  return (
    <>
      <GradientBackdrop />
      <Routes>
        <Route path="/" element={<Inventaire />} />
        <Route path="/plats" element={<Plats />} />
        <Route path="/plats/nouveau" element={<ComposerPlat />} />
        <Route path="/plats/:platId/modifier" element={<ComposerPlat />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/ajout" element={<AjoutManuel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingTabBar />
    </>
  )
}

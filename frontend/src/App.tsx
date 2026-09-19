import { useLayoutEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import BarreNavigation from './components/BarreNavigation'
import { AnnulationProvider } from './components/UndoSnackbar'
import AjoutManuel from './pages/AjoutManuel'
import ComposerPlat from './pages/ComposerPlat'
import Courses from './pages/Courses'
import DetailLot from './pages/DetailLot'
import DetailPlat from './pages/DetailPlat'
import Historique from './pages/Historique'
import Inventaire from './pages/Inventaire'
import Plats from './pages/Plats'
import PreparerPlat from './pages/PreparerPlat'
import Reglages from './pages/Reglages'
import Scan from './pages/Scan'

export default function App() {
  const { pathname } = useLocation()
  // La page défile sur le document : sans cela, un écran s'ouvrirait à la
  // hauteur où l'on avait laissé le précédent.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <AnnulationProvider>
      {/* Bande sous la barre d'état iOS, transparente en plein écran : le
          contenu qui défile passerait sinon sous l'heure et la batterie. */}
      <div className="barre-etat" />
      <Routes>
        <Route path="/" element={<Inventaire />} />
        <Route path="/lot/:lotId" element={<DetailLot />} />
        <Route path="/ajout" element={<AjoutManuel />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/plats" element={<Plats />} />
        <Route path="/plats/nouveau" element={<ComposerPlat />} />
        <Route path="/plats/:platId" element={<DetailPlat />} />
        <Route path="/plats/:platId/modifier" element={<ComposerPlat />} />
        <Route path="/plats/:platId/preparer" element={<PreparerPlat />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BarreNavigation />
    </AnnulationProvider>
  )
}

import { useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './components/Authentification'
import BarreNavigation from './components/BarreNavigation'
import { Squelette } from './components/EtatDonnees'
import { AnnulationProvider } from './components/UndoSnackbar'
import AjoutManuel from './pages/AjoutManuel'
import Compte from './pages/Compte'
import ComposerPlat from './pages/ComposerPlat'
import Connexion from './pages/Connexion'
import Courses from './pages/Courses'
import DetailLot from './pages/DetailLot'
import DetailPlat from './pages/DetailPlat'
import Historique from './pages/Historique'
import Inventaire from './pages/Inventaire'
import Plats from './pages/Plats'
import PreparerPlat from './pages/PreparerPlat'
import Reglages from './pages/Reglages'
import Scan from './pages/Scan'
import { demanderDeverrouillage, verrouEnregistre } from './utils/verrouillage'

export default function App() {
  return (
    <AuthProvider>
      <AnnulationProvider>
        {/* Bande sous la barre d'état iOS, transparente en plein écran : le
            contenu qui défile passerait sinon sous l'heure et la batterie. */}
        <div className="barre-etat" />
        <Application />
      </AnnulationProvider>
    </AuthProvider>
  )
}

function Application() {
  const { profil, avis } = useAuth()
  const { pathname } = useLocation()
  // La page défile sur le document : sans cela, un écran s'ouvrirait à la
  // hauteur où l'on avait laissé le précédent.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Session en cours de vérification : ni l'application ni la connexion, sinon
  // l'écran de connexion clignoterait à chaque ouverture.
  if (profil === undefined) return <Squelette />
  if (profil === null) return <Connexion message={avis} />

  return (
    <Verrou>
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
        <Route path="/compte" element={<Compte />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BarreNavigation />
    </Verrou>
  )
}

/**
 * Face ID à l'ouverture, quand l'utilisateur l'a activé.
 *
 * Le verrou est local à l'appareil : il masque l'inventaire à qui prend le
 * téléphone en main. La session, elle, reste valable côté serveur.
 */
function Verrou({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(!verrouEnregistre())
  const [refus, setRefus] = useState(false)

  const deverrouiller = async () => {
    setRefus(false)
    if (await demanderDeverrouillage()) setOuvert(true)
    else setRefus(true)
  }

  useEffect(() => {
    if (!ouvert) void deverrouiller()
    // Au montage uniquement : les essais suivants passent par le bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (ouvert) return <>{children}</>

  return (
    <main className="page">
      <div className="vide" style={{ paddingTop: 90 }}>
        <h1 className="vide-titre">Fridgify est verrouillé.</h1>
        <p className="texte-aide">
          Déverrouillez avec Face ID, Touch ID ou votre empreinte pour retrouver votre frigo.
        </p>
        {refus && <p className="texte-aide">La vérification n'a pas abouti.</p>}
        <button type="button" className="btn btn-plein btn-grand" onClick={deverrouiller}>
          Déverrouiller
        </button>
      </div>
    </main>
  )
}

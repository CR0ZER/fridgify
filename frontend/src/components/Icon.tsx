/**
 * Jeu d'icones inline, en remplacement de @expo/vector-icons.
 *
 * Les tracer a la main evite d'embarquer une police d'icones entiere pour la
 * douzaine de glyphes reellement utilises, et garantit que tout fonctionne hors
 * ligne sans requete reseau.
 */

export type NomIcone =
  | 'frigo'
  | 'plat'
  | 'camera'
  | 'panier'
  | 'engrenage'
  | 'plus'
  | 'moins'
  | 'stats'
  | 'fermer'
  | 'crayon'
  | 'coche'
  | 'coche-cercle'
  | 'poubelle'
  | 'ouvrir'
  | 'retour'
  | 'cloche'

const TRACES: Record<NomIcone, JSX.Element> = {
  frigo: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="3" />
      <path d="M5 10h14" />
      <path d="M8.5 6v2" />
      <path d="M8.5 13v2.5" />
    </>
  ),
  plat: (
    <>
      <path d="M2.5 19.5h19" />
      <path d="M4.5 16.5a7.5 7.5 0 0 1 15 0z" />
      <path d="M12 9V7" />
      <circle cx="12" cy="5.6" r="1.3" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5a2 2 0 0 1 2-2h1.6a1 1 0 0 0 .83-.45l.94-1.4a1 1 0 0 1 .83-.45h5.6a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  panier: (
    <>
      <path d="M2.5 4h2.6l2.3 11.2a1.5 1.5 0 0 0 1.47 1.2h8.5a1.5 1.5 0 0 0 1.46-1.14L20.5 8H6.3" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  // Roue crantee a huit dents, tracee par calcul plutot qu'a vue : les sommets
  // sont echantillonnes a intervalle angulaire constant, ce qui garantit la
  // symetrie que l'oeil detecte immediatement sur ce genre de forme.
  engrenage: (
    <>
      <path d="M21.42 10.17L21.42 13.83L18.96 13.42L17.92 15.92L19.96 17.37L17.37 19.96L15.92 17.92L13.42 18.96L13.83 21.42L10.17 21.42L10.58 18.96L8.08 17.92L6.63 19.96L4.04 17.37L6.08 15.92L5.04 13.42L2.58 13.83L2.58 10.17L5.04 10.58L6.08 8.08L4.04 6.63L6.63 4.04L8.08 6.08L10.58 5.04L10.17 2.58L13.83 2.58L13.42 5.04L15.92 6.08L17.37 4.04L19.96 6.63L17.92 8.08L18.96 10.58Z" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  moins: <path d="M5.5 12h13" />,
  stats: (
    <>
      <path d="M5 20.5V13" />
      <path d="M12 20.5V4" />
      <path d="M19 20.5v-11" />
    </>
  ),
  fermer: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  crayon: (
    <>
      <path d="M15.5 4.5l4 4" />
      <path d="M17.6 2.4a2 2 0 0 1 2.83 0l1.17 1.17a2 2 0 0 1 0 2.83L8.5 19.5l-5 1.5 1.5-5z" />
    </>
  ),
  coche: <path d="M4.5 12.5l5 5 10-11" />,
  'coche-cercle': (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </>
  ),
  poubelle: (
    <>
      <path d="M3.5 6h17" />
      <path d="M9 6V3.5h6V6" />
      <path d="M5.5 6l1 14a2 2 0 0 0 2 1.9h7a2 2 0 0 0 2-1.9l1-14" />
      <path d="M10 10.5v7" />
      <path d="M14 10.5v7" />
    </>
  ),
  ouvrir: (
    <>
      <rect x="4" y="10.5" width="16" height="11" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 7.8-1.3" />
    </>
  ),
  retour: <path d="M15 4.5l-7.5 7.5L15 19.5" />,
  cloche: (
    <>
      <path d="M18 16.5H6l1.4-2.3V10a4.6 4.6 0 0 1 9.2 0v4.2z" />
      <path d="M10.3 19.2a1.9 1.9 0 0 0 3.4 0" />
      <path d="M12 5.4V3.5" />
    </>
  ),
}

type Props = {
  nom: NomIcone
  taille?: number
  couleur?: string
  epaisseur?: number
}

export default function Icon({ nom, taille = 20, couleur = 'currentColor', epaisseur = 1.8 }: Props) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {TRACES[nom]}
    </svg>
  )
}

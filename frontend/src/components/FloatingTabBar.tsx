import { NavLink, useNavigate } from 'react-router-dom'

import Icon, { type NomIcone } from './Icon'
import styles from './FloatingTabBar.module.css'

const ONGLETS: { to: string; icone: NomIcone; label: string }[] = [
  { to: '/', icone: 'frigo', label: 'Inventaire' },
  { to: '/plats', icone: 'plat', label: 'Plats' },
  { to: '/scan', icone: 'camera', label: 'Scanner' },
  { to: '/courses', icone: 'panier', label: 'Courses' },
]

export default function FloatingTabBar() {
  const naviguer = useNavigate()

  return (
    <nav className={styles.wrapper} aria-label="Navigation principale">
      <button
        type="button"
        className={`${styles.verre} ${styles.boutonAjout}`}
        onClick={() => naviguer('/ajout')}
        aria-label="Ajouter un produit manuellement"
      >
        <Icon nom="plus" taille={28} epaisseur={2} />
      </button>

      <div className={`${styles.verre} ${styles.barre}`}>
        {ONGLETS.map(({ to, icone, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              isActive ? `${styles.onglet} ${styles.ongletActif}` : styles.onglet
            }
          >
            <Icon nom={icone} taille={20} />
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

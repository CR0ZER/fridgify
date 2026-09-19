import { useId } from 'react'

import type { Categorie } from '../api/types'
import styles from './CategorieSelect.module.css'

type Props = {
  label?: string
  valeur: string
  categories: Categorie[]
  onChange: (nom: string) => void
}

/**
 * Liste fermée de catégories.
 *
 * Remplace la saisie libre, qui laissait cohabiter « Légume » et « Légumes » et
 * fabriquait deux filtres pour une même chose. Le `<select>` natif ouvre la roue
 * iOS, ce qui reste le contrôle le plus rapide sur téléphone.
 */
export default function CategorieSelect({ label, valeur, categories, onChange }: Props) {
  const id = useId()

  return (
    <div className={styles.champ}>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <select
        id={id}
        className={styles.select}
        value={valeur}
        onChange={(event) => onChange(event.target.value)}
      >
        {categories.map((categorie) => (
          <option key={categorie.nom} value={categorie.nom}>
            {categorie.nom}
          </option>
        ))}
      </select>
    </div>
  )
}

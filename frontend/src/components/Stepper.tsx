type Props = {
  valeur: number
  min?: number
  max: number
  onChange: (valeur: number) => void
  /** Ce que l'on compte, pour les lecteurs d'écran : « Tomates », « portion »… */
  label: string
  className?: string
}

/** Compteur − / + en entiers bornés : une unité est indivisible. */
export default function Stepper({ valeur, min = 0, max, onChange, label, className }: Props) {
  const cadrer = (v: number) => Math.min(Math.max(v, min), max)

  return (
    <div className={className ? `stepper ${className}` : 'stepper'}>
      <button
        type="button"
        onClick={() => onChange(cadrer(valeur - 1))}
        disabled={valeur <= min}
        aria-label={`Retirer ${label}`}
      >
        −
      </button>
      <output className={valeur === 0 ? 'zero' : undefined} aria-live="polite">
        {valeur}
      </output>
      <button
        type="button"
        onClick={() => onChange(cadrer(valeur + 1))}
        disabled={valeur >= max}
        aria-label={`Ajouter ${label}`}
      >
        +
      </button>
    </div>
  )
}

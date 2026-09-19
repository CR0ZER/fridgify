import { useId } from 'react'

import styles from './DateField.module.css'

type Props = {
  label: string
  value: string
  onChange: (isoDate: string) => void
}

export default function DateField({ label, value, onChange }: Props) {
  const id = useId()

  return (
    <div className={styles.champ}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

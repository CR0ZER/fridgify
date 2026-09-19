import type { CSSProperties, ReactNode } from 'react'

import styles from './GlassCard.module.css'

type Props = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export default function GlassCard({ children, className, style }: Props) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card} style={style}>
      {children}
    </div>
  )
}

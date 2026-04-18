import { type HTMLAttributes, createElement } from 'react'

import { panelClasses } from '../uiStyles'

type CardAccent = 'left' | 'none'

const accentClasses: Record<CardAccent, string> = {
  left: 'border-l-4 border-l-green-700',
  none: '',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: CardAccent
}

export function Card({ accent, className = '', children, ...rest }: CardProps) {
  const classes = [
    panelClasses(),
    accent ? accentClasses[accent] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement('div', { className: classes, ...rest }, children)
}
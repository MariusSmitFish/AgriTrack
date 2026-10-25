import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { PedigreeNode } from '../../lib/animals'

interface PedigreeNodeCardProps {
  node: PedigreeNode
  featured?: boolean
  onSelect?: (animalId: string) => void
  style?: CSSProperties
}

export function PedigreeNodeCard({ node, featured = false, onSelect, style }: PedigreeNodeCardProps) {
  const animal = node.animal
  const sex = animal?.sex
  const clickable = Boolean(animal && onSelect)

  const sexAccent =
    sex === 'female'
      ? 'border-pasture-600 bg-gradient-to-br from-pasture-50 to-white'
      : sex === 'male'
        ? 'border-barn-500 bg-gradient-to-br from-barn-100 to-white'
        : node.kind === 'external'
          ? 'border-dashed border-soil-500/40 bg-field/80'
          : 'border-field-dark bg-white/80'

  const size = featured
    ? 'min-w-[10.5rem] px-4 py-3.5 sm:min-w-[12rem]'
    : 'min-w-[8.5rem] px-3 py-2.5 sm:min-w-[9.5rem]'

  const name = animal?.name?.trim()
  const showName = Boolean(name && name !== node.label)

  const content = (
    <>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-soil-500">
        {node.role}
      </p>
      <p
        className={`mt-1 font-display font-bold text-pasture-900 ${
          featured ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
        }`}
      >
        {node.label}
      </p>
      {showName && <p className="mt-0.5 break-words text-xs font-semibold text-soil-700">{name}</p>}
      {node.detail && <p className="mt-0.5 text-xs text-soil-500">{node.detail}</p>}
      {animal?.status && animal.status !== 'active' && (
        <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-barn-600">
          {animal.status}
        </p>
      )}
    </>
  )

  const className = `pedigree-node rounded-2xl border-2 text-left shadow-sm shadow-pasture-900/5 transition ${sexAccent} ${size} ${
    clickable ? 'hover:-translate-y-0.5 hover:shadow-md' : ''
  } ${featured ? 'ring-2 ring-pasture-600/20' : ''}`

  return (
    <div className={className} style={style}>
      {clickable && animal ? (
        <button
          type="button"
          className="block w-full cursor-pointer bg-transparent p-0 text-left"
          onClick={() => onSelect?.(animal.id)}
        >
          {content}
        </button>
      ) : (
        content
      )}
      {animal && (
        <Link
          to={`/app/animals/${animal.id}`}
          className="mt-2 inline-flex text-xs font-semibold text-pasture-800 hover:text-pasture-700"
        >
          Open
        </Link>
      )}
    </div>
  )
}

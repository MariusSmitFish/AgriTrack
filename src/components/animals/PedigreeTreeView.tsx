import type { ReactNode } from 'react'
import { animalLabel, formatAnimalSex, type PedigreeTree } from '../../lib/animals'
import { offspringNoun } from '../../lib/speciesTerms'
import { PedigreeNodeCard } from './PedigreeNodeCard'

interface PedigreeTreeViewProps {
  tree: PedigreeTree
  onSelectAnimal: (animalId: string) => void
}

function GenerationLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-soil-500">
      {children}
    </p>
  )
}

export function PedigreeTreeView({ tree, onSelectAnimal }: PedigreeTreeViewProps) {
  const focusNode = {
    kind: 'animal' as const,
    animal: tree.focus,
    label: animalLabel(tree.focus),
    detail:
      [tree.focus.breed, tree.focus.sex ? formatAnimalSex(tree.focus.sex) : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    role: 'Selected animal',
  }

  return (
    <div className="pedigree-stage overflow-x-auto pb-2">
      <div className="mx-auto flex min-w-[42rem] flex-col items-center gap-8 px-2 py-4 sm:min-w-0 sm:px-4">
        <section className="w-full max-w-4xl animate-[pedigreeFade_0.5s_ease-out]">
          <GenerationLabel>Grandparents</GenerationLabel>
          <div className="grid grid-cols-4 gap-3">
            <PedigreeNodeCard node={tree.paternalGrandsire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={tree.paternalGranddam} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={tree.maternalGrandsire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={tree.maternalGranddam} onSelect={onSelectAnimal} />
          </div>
          <div className="relative mx-auto mt-2 h-8 max-w-3xl">
            <div className="absolute left-[12.5%] right-[62.5%] top-0 h-4 border-x border-t border-pasture-200" />
            <div className="absolute left-[62.5%] right-[12.5%] top-0 h-4 border-x border-t border-pasture-200" />
            <div className="absolute left-[25%] top-4 h-4 w-px bg-pasture-200" />
            <div className="absolute right-[25%] top-4 h-4 w-px bg-pasture-200" />
          </div>
        </section>

        <section className="w-full max-w-xl animate-[pedigreeFade_0.55s_ease-out]">
          <GenerationLabel>Parents</GenerationLabel>
          <div className="grid grid-cols-2 gap-4">
            <PedigreeNodeCard node={tree.sire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={tree.dam} onSelect={onSelectAnimal} />
          </div>
          <div className="relative mx-auto mt-2 h-8 max-w-xs">
            <div className="absolute left-[25%] right-[25%] top-0 h-4 border-x border-t border-pasture-300" />
            <div className="absolute left-1/2 top-4 h-4 w-px -translate-x-px bg-pasture-300" />
          </div>
        </section>

        <section className="animate-[pedigreeFade_0.6s_ease-out]">
          <GenerationLabel>Focus</GenerationLabel>
          <div className="flex justify-center">
            <PedigreeNodeCard node={focusNode} featured />
          </div>
        </section>

        <section className="w-full max-w-4xl animate-[pedigreeFade_0.7s_ease-out]">
          <div className="relative mx-auto mb-2 h-8 max-w-lg">
            <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-px bg-pasture-300" />
            <div className="absolute left-[10%] right-[10%] top-4 h-px bg-pasture-200" />
          </div>
          <GenerationLabel>Offspring ({tree.offspring.length})</GenerationLabel>
          {tree.offspring.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-field-dark bg-white/50 px-4 py-6 text-center text-sm text-soil-500">
              No {offspringNoun(tree.focus.species, true)} linked yet. Set this animal as dam or
              sire on another record.
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {tree.offspring.map((child, index) => {
                const childYoung = offspringNoun(child.species ?? tree.focus.species)
                const childTitle = childYoung.charAt(0).toUpperCase() + childYoung.slice(1)
                return (
                  <PedigreeNodeCard
                    key={child.id}
                    node={{
                      kind: 'animal',
                      animal: child,
                      label: animalLabel(child),
                      detail:
                        [child.breed, child.birth_date].filter(Boolean).join(' · ') || undefined,
                      role:
                        child.dam_id === tree.focus.id
                          ? `${childTitle} (dam)`
                          : `${childTitle} (sire)`,
                    }}
                    onSelect={onSelectAnimal}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

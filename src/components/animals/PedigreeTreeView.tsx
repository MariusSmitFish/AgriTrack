import type { ReactNode } from 'react'
import { animalLabel, formatAnimalSex, type PedigreeNode, type PedigreeTree } from '../../lib/animals'
import { otherFarmPedigreeNode, type OtherFarmRelative, type OtherFarmRelation } from '../../lib/otherFarmFamily'
import { offspringNoun } from '../../lib/speciesTerms'
import { PedigreeNodeCard } from './PedigreeNodeCard'

interface PedigreeTreeViewProps {
  tree: PedigreeTree
  onSelectAnimal: (animalId: string) => void
  otherFarm?: OtherFarmRelative[]
}

function GenerationLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-soil-500">
      {children}
    </p>
  )
}

function offspringSexSummary(offspring: Array<{ sex: string | null }>) {
  let females = 0
  let males = 0
  let unknown = 0
  for (const child of offspring) {
    if (child.sex === 'female') females += 1
    else if (child.sex === 'male') males += 1
    else unknown += 1
  }
  const parts = [`${females}F`, `${males}M`]
  if (unknown > 0) parts.push(`${unknown} unknown`)
  return parts.join(', ')
}

function otherByRelation(otherFarm: OtherFarmRelative[], relation: OtherFarmRelation) {
  return otherFarm.find((relative) => relative.relation === relation)
}

function visibleNode(local: PedigreeNode, other: OtherFarmRelative | undefined, role: string) {
  if (local.kind === 'animal' || !other) return local
  return otherFarmPedigreeNode(other, role)
}

export function PedigreeTreeView({ tree, onSelectAnimal, otherFarm = [] }: PedigreeTreeViewProps) {
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
  const sire = visibleNode(tree.sire, otherByRelation(otherFarm, 'sire'), 'Sire')
  const dam = visibleNode(tree.dam, otherByRelation(otherFarm, 'dam'), 'Dam')
  const paternalGrandsire = visibleNode(
    tree.paternalGrandsire,
    otherByRelation(otherFarm, 'paternal_grandsire'),
    'Paternal grandsire',
  )
  const paternalGranddam = visibleNode(
    tree.paternalGranddam,
    otherByRelation(otherFarm, 'paternal_granddam'),
    'Paternal granddam',
  )
  const maternalGrandsire = visibleNode(
    tree.maternalGrandsire,
    otherByRelation(otherFarm, 'maternal_grandsire'),
    'Maternal grandsire',
  )
  const maternalGranddam = visibleNode(
    tree.maternalGranddam,
    otherByRelation(otherFarm, 'maternal_granddam'),
    'Maternal granddam',
  )
  const otherOffspring = otherFarm.filter(
    (relative) => relative.relation === 'offspring_dam' || relative.relation === 'offspring_sire',
  )
  const offspringCount = tree.offspring.length + otherOffspring.length

  return (
    <div className="pedigree-stage overflow-x-auto pb-2">
      <div className="mx-auto flex min-w-[42rem] flex-col items-center gap-8 px-2 py-4 sm:min-w-0 sm:px-4">
        <section className="w-full max-w-4xl animate-[pedigreeFade_0.5s_ease-out]">
          <GenerationLabel>Grandparents</GenerationLabel>
          <div className="grid grid-cols-4 gap-3">
            <PedigreeNodeCard node={paternalGrandsire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={paternalGranddam} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={maternalGrandsire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={maternalGranddam} onSelect={onSelectAnimal} />
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
            <PedigreeNodeCard node={sire} onSelect={onSelectAnimal} />
            <PedigreeNodeCard node={dam} onSelect={onSelectAnimal} />
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
          <GenerationLabel>
            {`Offspring (${offspringCount === 0 ? '0' : offspringSexSummary([...tree.offspring, ...otherOffspring])})`}
          </GenerationLabel>
          {offspringCount === 0 ? (
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
              {otherOffspring.map((child, index) => {
                const childYoung = offspringNoun(tree.focus.species)
                const childTitle = childYoung.charAt(0).toUpperCase() + childYoung.slice(1)
                return (
                  <PedigreeNodeCard
                    key={child.animalKey}
                    node={otherFarmPedigreeNode(
                      child,
                      child.relation === 'offspring_dam' ? `${childTitle} (dam)` : `${childTitle} (sire)`,
                    )}
                    style={{ animationDelay: `${0.05 * (tree.offspring.length + index)}s` }}
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

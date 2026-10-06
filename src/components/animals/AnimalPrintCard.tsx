import { useEffect, useState, type ReactNode } from 'react'
import type { Animal, AnimalAchievement, AnimalInoculation, AnimalPhotoWithUrl } from '../../lib/types'
import {
  animalLabel,
  formatAnimalId,
  formatAnimalSex,
  formatAnimalStatus,
  formatSpecies,
  formatTagNumber,
  getAnimalById,
} from '../../lib/animals'
import { fetchAnimalInoculations, formatInoculationDate, healthKindLabel } from '../../lib/inoculations'
import { fetchAnimalPhotos, formatPhotoDate } from '../../lib/animalPhotos'
import { fetchAnimalAchievements } from '../../lib/achievements'

interface AnimalPrintCardProps {
  animal: Animal
  herdAnimals: Animal[]
  placeDisplay: string
}

export function AnimalPrintCard({ animal, herdAnimals, placeDisplay }: AnimalPrintCardProps) {
  const [photo, setPhoto] = useState<AnimalPhotoWithUrl | null>(null)
  const [inoculations, setInoculations] = useState<AnimalInoculation[]>([])
  const [achievements, setAchievements] = useState<AnimalAchievement[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [photos, records, showResults] = await Promise.all([
          fetchAnimalPhotos(animal.id),
          fetchAnimalInoculations(animal.id),
          fetchAnimalAchievements(animal.id),
        ])
        if (cancelled) return
        setPhoto(photos[0] ?? null)
        setInoculations(records.slice(0, 6))
        setAchievements(showResults.slice(0, 6))
      } catch {
        if (!cancelled) {
          setPhoto(null)
          setInoculations([])
          setAchievements([])
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [animal.id])

  const dam = getAnimalById(herdAnimals, animal.dam_id)
  const sire = getAnimalById(herdAnimals, animal.sire_id)
  const damLabel = dam
    ? animalLabel(dam)
    : animal.dam_tag_number
      ? `Tag ${animal.dam_tag_number}`
      : '—'
  const sireLabel = sire
    ? animalLabel(sire)
    : animal.sire_name?.trim() || '—'

  return (
    <CardPrintShell>
      <div className="print-only-block hidden print:block">
        <header className="border-b border-soil-800/20 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soil-500">
            AgriScale Farm animal card
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-pasture-900">
            {animalLabel(animal)}
          </h2>
          <p className="mt-1 text-sm text-soil-600">
            {[animal.breed, formatAnimalSex(animal.sex), formatAnimalStatus(animal.status)]
              .filter((v) => v && v !== '—')
              .join(' · ')}
          </p>
        </header>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="col-span-2 grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Animal ID', value: formatAnimalId(animal) ?? '—' },
              { label: 'Tag number', value: formatTagNumber(animal) ?? '—' },
              { label: 'Studbook number', value: animal.studbook_number ?? '—' },
              { label: 'Schedule', value: animal.studbook_schedule ?? '—' },
              { label: 'Selection', value: animal.selection ?? '—' },
              { label: 'Name', value: animal.name ?? '—' },
              { label: 'Electronic ID', value: animal.electronic_id ?? '—' },
              { label: 'Birth date', value: animal.birth_date ?? '—' },
              { label: 'Lives at', value: placeDisplay },
              { label: 'Dam', value: damLabel },
              { label: 'Sire', value: sireLabel },
              { label: 'Color / markings', value: animal.color_markings ?? '—' },
              { label: 'Species', value: formatSpecies(animal.species) },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-soil-500">
                  {field.label}
                </p>
                <p className="mt-0.5 font-medium text-soil-800">{field.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-field-dark bg-panel-muted">
            {photo?.url ? (
              <img
                src={photo.url}
                alt={photo.caption || animalLabel(animal)}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-xs text-soil-500">
                No photo
              </div>
            )}
            {photo && (
              <p className="border-t border-field-dark px-2 py-1.5 text-[0.65rem] text-soil-500">
                {formatPhotoDate(photo.captured_at)}
              </p>
            )}
          </div>
        </div>

        {animal.notes && (
          <p className="mt-4 text-sm text-soil-700">
            <span className="font-semibold">Notes: </span>
            {animal.notes}
          </p>
        )}

        <section className="mt-5">
          <h3 className="font-display text-lg font-semibold text-pasture-900">
            Recent vaccinations and treatments
          </h3>
          {inoculations.length === 0 ? (
            <p className="mt-2 text-sm text-soil-500">None recorded.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium">Name</th>
                  <th className="py-1 font-medium">Administered</th>
                  <th className="py-1 font-medium">Next due</th>
                </tr>
              </thead>
              <tbody>
                {inoculations.map((record) => (
                  <tr key={record.id} className="border-b border-field-dark/50">
                    <td className="py-1.5 text-soil-600">{healthKindLabel(record.kind)}</td>
                    <td className="py-1.5 font-medium text-soil-800">{record.name}</td>
                    <td className="py-1.5 text-soil-600">
                      {formatInoculationDate(record.administered_at)}
                    </td>
                    <td className="py-1.5 text-soil-600">
                      {formatInoculationDate(record.next_due_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-5">
          <h3 className="font-display text-lg font-semibold text-pasture-900">Show results</h3>
          {achievements.length === 0 ? (
            <p className="mt-2 text-sm text-soil-500">None recorded.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="py-1 font-medium">Result</th>
                  <th className="py-1 font-medium">Show</th>
                  <th className="py-1 font-medium">Class</th>
                  <th className="py-1 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {achievements.map((record) => (
                  <tr key={record.id} className="border-b border-field-dark/50">
                    <td className="py-1.5 font-medium text-soil-800">{record.result}</td>
                    <td className="py-1.5 text-soil-600">{record.show_name}</td>
                    <td className="py-1.5 text-soil-600">{record.class_name ?? '—'}</td>
                    <td className="py-1.5 text-soil-600">{formatInoculationDate(record.shown_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="mt-6 text-[0.65rem] text-soil-500">
          Printed {new Date().toLocaleDateString()} · AgriScale Farm
        </p>
      </div>

      {/* Screen preview so users know what will print */}
      <div className="rounded-2xl border border-dashed border-pasture-600/40 bg-pasture-50/50 p-4 print:hidden">
        <p className="text-sm font-semibold text-pasture-900">Printable animal card</p>
        <p className="mt-1 text-sm text-soil-600">
          Use <span className="font-semibold">Print / PDF card</span> to save an A4 card with
          identity, parents, place, latest photo, recent vaccinations and treatments, and show results.
        </p>
      </div>
    </CardPrintShell>
  )
}

function CardPrintShell({ children }: { children: ReactNode }) {
  return <div className="animal-print-card">{children}</div>
}

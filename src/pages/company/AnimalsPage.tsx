import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Animal } from '../../lib/types'
import { formatAnimalSex, formatAnimalStatus } from '../../lib/animals'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
  PageHeader,
} from '../../components/layout/AppShell'

export function AnimalsPage() {
  const { profile } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnimals = async () => {
    if (!profile?.company_id) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('animals')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    else setAnimals(data ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadAnimals()
  }, [profile?.company_id])

  const displayId = (animal: Animal) =>
    animal.tag_number || animal.stud_tag_number || animal.name || 'Untagged'

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Animals"
          description="Livestock on your farm. Capture tags in the field with your camera."
        />
        <Link to="/app/animals/new" className="shrink-0">
          <Button className="w-full sm:w-auto">+ Capture animal</Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        {loading ? (
          <EmptyState>Loading animals...</EmptyState>
        ) : animals.length === 0 ? (
          <div className="text-center">
            <EmptyState>No animals recorded yet.</EmptyState>
            <Link to="/app/animals/new" className="mt-4 inline-block">
              <Button>Capture your first animal</Button>
            </Link>
          </div>
        ) : (
          <>
            <MobileCardList>
              {animals.map((animal) => (
                <MobileCard
                  key={animal.id}
                  title={displayId(animal)}
                  subtitle={animal.breed ?? animal.species ?? undefined}
                  fields={[
                    { label: 'Stud tag', value: animal.stud_tag_number ?? '—' },
                    { label: 'Sex', value: formatAnimalSex(animal.sex) },
                    { label: 'Status', value: formatAnimalStatus(animal.status) },
                    { label: 'Location', value: animal.location ?? '—' },
                  ]}
                />
              ))}
            </MobileCardList>

            <DesktopTable>
              <thead>
                <tr className="border-b border-field-dark text-soil-500">
                  <th className="pb-2 font-medium">Tag</th>
                  <th className="pb-2 font-medium">Stud tag</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Breed</th>
                  <th className="pb-2 font-medium">Sex</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((animal) => (
                  <tr key={animal.id} className="border-b border-field-dark/60">
                    <td className="py-3 font-medium text-soil-800">{animal.tag_number ?? '—'}</td>
                    <td className="py-3 text-soil-600">{animal.stud_tag_number ?? '—'}</td>
                    <td className="py-3 text-soil-600">{animal.name ?? '—'}</td>
                    <td className="py-3 text-soil-600">{animal.breed ?? '—'}</td>
                    <td className="py-3 text-soil-600">{formatAnimalSex(animal.sex)}</td>
                    <td className="py-3 text-soil-600">{formatAnimalStatus(animal.status)}</td>
                    <td className="py-3 text-soil-600">{animal.location ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </DesktopTable>
          </>
        )}
      </Card>
    </div>
  )
}

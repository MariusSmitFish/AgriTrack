import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOfflineRead } from '../../contexts/OfflineContext'
import { errorText } from '../../lib/offlineHerd'
import type {
  Animal,
  AnimalSelection,
  AnimalSex,
  AnimalStatus,
  Encampment,
  FarmLocation,
  StudbookSchedule,
} from '../../lib/types'
import {
  animalLabel,
  animalSelectionOptions,
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
  deleteAnimal,
  digitsOnly,
  formatSalePrice,
  formatTagNumber,
  padDigits,
  parseSalePrice,
  studbookScheduleOptions,
} from '../../lib/animals'
import { animalPlaceLabel, encampmentLabel, locationLabel, resolveAnimalPlace } from '../../lib/locations'
import { AnimalPhotosPanel } from '../../components/animals/AnimalPhotosPanel'
import { AnimalDocumentsPanel } from '../../components/animals/AnimalDocumentsPanel'
import { AnimalAchievementsPanel } from '../../components/animals/AnimalAchievementsPanel'
import { AnimalInoculationsPanel } from '../../components/animals/AnimalInoculationsPanel'
import { AnimalWeightsPanel } from '../../components/animals/AnimalWeightsPanel'
import { AnimalBreedingPanel } from '../../components/animals/AnimalBreedingPanel'
import { AnimalPrintCard } from '../../components/animals/AnimalPrintCard'
import { ParentPicker } from '../../components/animals/ParentPicker'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { CollapsibleCard, CollapsibleSection } from '../../components/ui/CollapsibleCard'
import { PageHeader } from '../../components/layout/AppShell'
import { todayDateValue } from '../../lib/inoculations'

interface AnimalDetailsForm {
  studbook_number: string
  studbook_schedule: StudbookSchedule | ''
  selection: AnimalSelection | ''
  name: string
  species: string
  breed: string
  sex: AnimalSex | ''
  status: AnimalStatus | ''
  birth_date: string
  color_markings: string
  notes: string
}

function detailsFromAnimal(animal: Animal): AnimalDetailsForm {
  const speciesMatch = animalSpeciesOptions.find(
    (option) => option.value === (animal.species ?? '').trim().toLowerCase(),
  )
  return {
    studbook_number: animal.studbook_number ?? '',
    studbook_schedule: animal.studbook_schedule ?? '',
    selection: animal.selection ?? '',
    name: animal.name ?? '',
    species: speciesMatch?.value ?? animal.species ?? 'goat',
    breed: animal.breed ?? '',
    sex: animal.sex ?? '',
    status: animal.status ?? 'active',
    birth_date: animal.birth_date ?? '',
    color_markings: animal.color_markings ?? '',
    notes: animal.notes ?? '',
  }
}

export function AnimalDetailPage() {
  const { animalId } = useParams<{ animalId: string }>()
  const { profile } = useAuth()
  const { ready, read, cacheKey, readOnly } = useOfflineRead()
  const navigate = useNavigate()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [herdAnimals, setHerdAnimals] = useState<Animal[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [encampments, setEncampments] = useState<Encampment[]>([])
  const [locationId, setLocationId] = useState('')
  const [encampmentId, setEncampmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingPlace, setSavingPlace] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingPedigree, setSavingPedigree] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  const [salePrice, setSalePrice] = useState('')
  const [soldOn, setSoldOn] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerSurname, setBuyerSurname] = useState('')
  const [saleNotes, setSaleNotes] = useState('')
  const [saleError, setSaleError] = useState('')
  const [saleSuccess, setSaleSuccess] = useState('')
  const [identity, setIdentity] = useState({ stud: '', year: '', number: '' })
  const [details, setDetails] = useState<AnimalDetailsForm | null>(null)
  const [damId, setDamId] = useState('')
  const [damTag, setDamTag] = useState('')
  const [sireId, setSireId] = useState('')
  const [sireName, setSireName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAnimal = async (showLoading = true) => {
    if (!animalId || !profile?.company_id || !ready) return

    if (showLoading) setLoading(true)
    setError('')
    const companyId = profile.company_id
    try {
      const data = await read(
        (saved) => ({
          animal: saved.animals.find((row) => row.id === animalId) ?? null,
          locations: saved.locations,
          encampments: saved.encampments,
          herd: [...saved.animals].sort((a, b) =>
            (a.tag_number ?? '').localeCompare(b.tag_number ?? '', undefined, { numeric: true }),
          ),
        }),
        async () => {
          const [animalRes, locationsRes, encampmentsRes, herdRes] = await Promise.all([
            supabase
              .from('animals')
              .select('*, encampments(id, name, location_id, locations(id, name))')
              .eq('id', animalId)
              .eq('company_id', companyId)
              .maybeSingle(),
            supabase.from('locations').select('*').eq('company_id', companyId).order('name'),
            supabase.from('encampments').select('*').eq('company_id', companyId).order('name'),
            supabase
              .from('animals')
              .select('*')
              .eq('company_id', companyId)
              .order('tag_number', { ascending: true }),
          ])
          if (animalRes.error) throw new Error(animalRes.error.message)
          if (locationsRes.error) throw new Error(locationsRes.error.message)
          if (encampmentsRes.error) throw new Error(encampmentsRes.error.message)
          if (herdRes.error) throw new Error(herdRes.error.message)
          return {
            animal: animalRes.data,
            locations: locationsRes.data ?? [],
            encampments: encampmentsRes.data ?? [],
            herd: herdRes.data ?? [],
          }
        },
      )

      if (!data.animal) {
        setAnimal(null)
        setError('Animal not found.')
      } else {
        const animalRow = data.animal
        setAnimal(animalRow)
        setIdentity({
          stud: animalRow.stud_number ?? '',
          year: animalRow.id_year ?? '',
          number: animalRow.id_number ?? '',
        })
        setDetails(detailsFromAnimal(animalRow))
        setDamId(animalRow.dam_id ?? '')
        setDamTag(animalRow.dam_tag_number ?? '')
        setSireId(animalRow.sire_id ?? '')
        setSireName(animalRow.sire_name ?? '')
        setSalePrice(animalRow.sale_price == null ? '' : String(animalRow.sale_price))
        setSoldOn(animalRow.sold_on ?? todayDateValue())
        setBuyerName(animalRow.buyer_name ?? '')
        setBuyerSurname(animalRow.buyer_surname ?? '')
        setSaleNotes(animalRow.sale_notes ?? '')
        const place = resolveAnimalPlace(animalRow, data.locations, data.encampments)
        setEncampmentId(place.camp?.id ?? animalRow.encampment_id ?? '')
        setLocationId(place.location?.id ?? '')
      }

      setLocations(data.locations)
      setEncampments(data.encampments)
      setHerdAnimals(data.herd)
    } catch (err) {
      setError(errorText(err, 'Failed to load animal'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnimal()
  }, [animalId, profile?.company_id, ready, cacheKey])

  const offlineWriteError = () => {
    if (!readOnly) return false
    setError('You are offline. This record is view only until the connection returns.')
    return true
  }

  const campsForLocation = useMemo(
    () => encampments.filter((e) => e.location_id === locationId),
    [encampments, locationId],
  )

  const mothers = useMemo(
    () => herdAnimals.filter((a) => a.id !== animal?.id && a.sex !== 'male'),
    [herdAnimals, animal],
  )

  const fathers = useMemo(
    () => herdAnimals.filter((a) => a.id !== animal?.id && a.sex !== 'female'),
    [herdAnimals, animal],
  )

  const resolvedPlace = animal ? resolveAnimalPlace(animal, locations, encampments) : null
  const placeDisplay = animal
    ? animalPlaceLabel({
        encampment: resolvedPlace?.camp ?? animal.encampments,
        location: resolvedPlace?.location ?? animal.encampments?.locations,
        legacyLocation: animal.location,
      })
    : '—'

  const handleDeleteAnimal = async () => {
    if (!animal) return
    if (offlineWriteError()) return
    const label = animalLabel(animal)
    if (
      !window.confirm(
        `Delete ${label}? Photos, documents, health records, and show results for this animal will also be removed.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError('')
    try {
      await deleteAnimal(animal)
      navigate('/app/animals', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete animal')
      setDeleting(false)
    }
  }

  const handleSavePlace = async (e: FormEvent) => {
    e.preventDefault()
    if (offlineWriteError()) return
    if (!animal || !profile?.company_id) return

    setSavingPlace(true)
    setError('')
    setSuccess('')

    const selectedLocation = locations.find((l) => l.id === locationId)
    const selectedCamp = encampments.find((c) => c.id === encampmentId)
    const label = animalPlaceLabel({
      location: selectedLocation,
      encampment: selectedCamp,
    })

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        encampment_id: encampmentId || null,
        location: label === '—' ? null : label,
      })
      .eq('id', animal.id)

    if (updateError) {
      setError(updateError.message)
      setSavingPlace(false)
      return
    }

    setSuccess('Living place updated.')
    await loadAnimal(false)
    setSavingPlace(false)
  }

  const handleSaveIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (offlineWriteError()) return
    if (!animal) return

    const stud = padDigits(identity.stud, 4)
    const year = padDigits(identity.year, 2)
    const number = padDigits(identity.number, 4)
    if (!/^\d{4}$/.test(stud) || !/^\d{2}$/.test(year) || !/^\d{4}$/.test(number)) {
      setError('Animal ID needs a 4-digit stud, 2-digit year, and 4-digit number.')
      return
    }

    const clash = herdAnimals.find(
      (other) =>
        other.id !== animal.id &&
        padDigits(other.stud_number ?? '', 4) === stud &&
        (other.id_year ?? '') === year &&
        padDigits(other.id_number ?? '', 4) === number,
    )
    if (clash) {
      setError(`Animal ID ${stud}-${year}-${number} is already used by ${animalLabel(clash)}.`)
      return
    }

    setSavingIdentity(true)
    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        stud_number: stud,
        id_year: year,
        id_number: number,
        tag_number: `${year}-${number}`,
      })
      .eq('id', animal.id)

    if (updateError) {
      setError(updateError.message)
      setSavingIdentity(false)
      return
    }

    setIdentity({ stud, year, number })
    setSuccess('Animal ID updated.')
    await loadAnimal(false)
    setSavingIdentity(false)
  }

  const setDetail = <K extends keyof AnimalDetailsForm>(key: K, value: AnimalDetailsForm[K]) => {
    setDetails((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault()
    if (offlineWriteError()) return
    if (!animal || !details) return

    const opt = (value: string) => (value.trim() === '' ? null : value.trim())
    setSavingDetails(true)
    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        studbook_number: details.studbook_number.replace(/\D/g, '') || null,
        studbook_schedule: details.studbook_schedule || null,
        selection: details.selection || null,
        name: opt(details.name),
        species: opt(details.species) ?? 'goat',
        breed: opt(details.breed),
        sex: details.sex || null,
        status: details.status || null,
        birth_date: details.birth_date || null,
        color_markings: opt(details.color_markings),
        notes: opt(details.notes),
      })
      .eq('id', animal.id)

    if (updateError) {
      setError(updateError.message)
      setSavingDetails(false)
      return
    }

    setSuccess('Animal details updated.')
    await loadAnimal(false)
    setSavingDetails(false)
  }

  const handleSavePedigree = async (e: FormEvent) => {
    e.preventDefault()
    if (offlineWriteError()) return
    if (!animal) return

    setSavingPedigree(true)
    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        dam_id: damId || null,
        dam_tag_number: damTag || null,
        sire_id: sireId || null,
        sire_name: sireName || null,
      })
      .eq('id', animal.id)

    if (updateError) {
      setError(updateError.message)
      setSavingPedigree(false)
      return
    }

    setSuccess('Pedigree updated.')
    await loadAnimal(false)
    setSavingPedigree(false)
  }

  const handleSaveSale = async (e: FormEvent) => {
    e.preventDefault()
    if (offlineWriteError()) return
    if (!animal) return

    const price = parseSalePrice(salePrice)
    if (price == null) {
      setSaleError('Enter a sale price greater than zero.')
      setSaleSuccess('')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(soldOn)) {
      setSaleError('Choose the date this animal was sold.')
      setSaleSuccess('')
      return
    }

    setSavingSale(true)
    setSaleError('')
    setSaleSuccess('')

    const optional = (value: string) => value.trim() || null
    const { error: updateError } = await supabase
      .from('animals')
      .update({
        sale_price: price,
        sold_on: soldOn,
        buyer_name: optional(buyerName),
        buyer_surname: optional(buyerSurname),
        sale_notes: optional(saleNotes),
        status: 'sold',
      })
      .eq('id', animal.id)

    if (updateError) {
      setSaleError(updateError.message)
      setSavingSale(false)
      return
    }

    setSaleSuccess('Sale recorded. This animal is marked sold.')
    await loadAnimal(false)
    setSavingSale(false)
  }

  const handleClearSale = async () => {
    if (!animal?.sale_price) return
    if (offlineWriteError()) return
    if (!window.confirm('Remove the sale price, date, buyer, and notes for this animal?')) return

    setSavingSale(true)
    setSaleError('')
    setSaleSuccess('')

    const { error: updateError } = await supabase
      .from('animals')
      .update({
        sale_price: null,
        sold_on: null,
        buyer_name: null,
        buyer_surname: null,
        sale_notes: null,
        status: animal.status === 'sold' ? 'active' : animal.status,
      })
      .eq('id', animal.id)

    if (updateError) {
      setSaleError(updateError.message)
      setSavingSale(false)
      return
    }

    setSaleSuccess('Sale removed.')
    await loadAnimal(false)
    setSavingSale(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-soil-500">Loading animal...</p>
        </Card>
      </div>
    )
  }

  if (error && !animal) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/app/animals" className="mt-4 inline-block">
            <Button variant="secondary">Back to animals</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (!animal || !profile?.company_id) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader title="Animal" />
        <Card>
          <p className="text-sm text-red-600">Animal not found.</p>
          <Link to="/app/animals" className="mt-4 inline-block">
            <Button variant="secondary">Back to animals</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader
            title={animalLabel(animal)}
            description="Update this animal’s details, place, and records."
          />
          <p className="mt-2 text-sm text-soil-700 print:hidden">
            <span className="font-semibold text-soil-800">Lives at </span>
            {placeDisplay}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row print:hidden">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => window.print()}
          >
            Print / PDF card
          </Button>
          <Link to={`/app/family-trees?animal=${animal.id}`} className="block w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Family tree
            </Button>
          </Link>
          <Link to="/app/animals" className="block w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              All animals
            </Button>
          </Link>
          <Button
            variant="danger"
            className="w-full sm:w-auto"
            disabled={deleting}
            onClick={handleDeleteAnimal}
          >
            {deleting ? 'Deleting...' : 'Delete animal'}
          </Button>
        </div>
      </div>

      <AnimalPrintCard animal={animal} herdAnimals={herdAnimals} placeDisplay={placeDisplay} />

      <CollapsibleCard
        title="Animal ID"
        description="Stud, year, and number can be changed. The tag number follows the year and number."
        className="print:hidden"
      >
        <form onSubmit={handleSaveIdentity} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Stud number"
            inputMode="numeric"
            value={identity.stud}
            onChange={(e) => setIdentity((prev) => ({ ...prev, stud: digitsOnly(e.target.value, 4) }))}
            onBlur={(e) =>
              setIdentity((prev) => ({ ...prev, stud: padDigits(e.target.value, 4) }))
            }
            placeholder="####"
            maxLength={4}
            required
          />
          <Input
            label="Year"
            inputMode="numeric"
            value={identity.year}
            onChange={(e) => setIdentity((prev) => ({ ...prev, year: digitsOnly(e.target.value, 2) }))}
            onBlur={(e) =>
              setIdentity((prev) => ({ ...prev, year: padDigits(e.target.value, 2) }))
            }
            placeholder="##"
            maxLength={2}
            required
          />
          <Input
            label="Number"
            inputMode="numeric"
            value={identity.number}
            onChange={(e) =>
              setIdentity((prev) => ({ ...prev, number: digitsOnly(e.target.value, 4) }))
            }
            onBlur={(e) =>
              setIdentity((prev) => ({ ...prev, number: padDigits(e.target.value, 4) }))
            }
            placeholder="####"
            maxLength={4}
            required
          />
          <p className="text-sm text-soil-600 sm:col-span-3">
            Animal ID{' '}
            <span className="font-semibold text-soil-800">
              {padDigits(identity.stud, 4) && padDigits(identity.year, 2) && padDigits(identity.number, 4)
                ? `${padDigits(identity.stud, 4)}-${padDigits(identity.year, 2)}-${padDigits(identity.number, 4)}`
                : '—'}
            </span>
            {padDigits(identity.year, 2) && padDigits(identity.number, 4)
              ? ` · tag ${padDigits(identity.year, 2)}-${padDigits(identity.number, 4)}`
              : ''}
          </p>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={savingIdentity} className="w-full sm:w-auto">
              {savingIdentity ? 'Saving...' : 'Save animal ID'}
            </Button>
          </div>
        </form>
      </CollapsibleCard>

      {details && (
        <CollapsibleCard
          title="Details"
          description="Name, studbook, sex, status, and the other basic fields for this animal."
          className="print:hidden"
        >
          <form onSubmit={handleSaveDetails} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name or nickname"
              value={details.name}
              onChange={(e) => setDetail('name', e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Studbook number"
              inputMode="numeric"
              value={details.studbook_number}
              onChange={(e) => setDetail('studbook_number', digitsOnly(e.target.value, 20))}
              placeholder="Large number"
              maxLength={20}
            />
            <Select
              label="Studbook schedule"
              id="detail-studbook-schedule"
              value={details.studbook_schedule}
              onChange={(e) =>
                setDetail('studbook_schedule', e.target.value as AnimalDetailsForm['studbook_schedule'])
              }
            >
              {studbookScheduleOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Selection"
              id="detail-selection"
              value={details.selection}
              onChange={(e) => setDetail('selection', e.target.value as AnimalDetailsForm['selection'])}
            >
              {animalSelectionOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Species"
              id="detail-species"
              value={details.species}
              onChange={(e) => setDetail('species', e.target.value)}
            >
              {!animalSpeciesOptions.some((option) => option.value === details.species) && (
                <option value={details.species}>{details.species}</option>
              )}
              {animalSpeciesOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Breed"
              value={details.breed}
              onChange={(e) => setDetail('breed', e.target.value)}
            />
            <Select
              label="Sex"
              id="detail-sex"
              value={details.sex}
              onChange={(e) => setDetail('sex', e.target.value as AnimalDetailsForm['sex'])}
            >
              {animalSexOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              id="detail-status"
              value={details.status}
              onChange={(e) => setDetail('status', e.target.value as AnimalDetailsForm['status'])}
            >
              {animalStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Birth date"
              type="date"
              value={details.birth_date}
              onChange={(e) => setDetail('birth_date', e.target.value)}
            />
            <Input
              label="Color / markings"
              value={details.color_markings}
              onChange={(e) => setDetail('color_markings', e.target.value)}
              placeholder="e.g. Black white face, horned"
            />
            <div className="md:col-span-2">
              <label htmlFor="detail-notes" className="block text-sm font-semibold text-soil-700">
                Notes
              </label>
              <textarea
                id="detail-notes"
                value={details.notes}
                onChange={(e) => setDetail('notes', e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={savingDetails} className="w-full sm:w-auto">
                {savingDetails ? 'Saving...' : 'Save details'}
              </Button>
            </div>
          </form>
        </CollapsibleCard>
      )}

      <CollapsibleCard
        title="Pedigree"
        description="Link mother and father. You can enter animal IDs even if they don't exist yet."
        className="print:hidden"
      >
        <form onSubmit={handleSavePedigree} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ParentPicker
            id="edit-mother"
            label="Mother"
            animals={mothers}
            selectedId={damId}
            onSelect={(id) => {
              const dam = mothers.find((animal) => animal.id === id)
              setDamId(id)
              setDamTag(dam ? formatTagNumber(dam) ?? '' : '')
            }}
            manualEntry={damId ? '' : damTag}
            onManualEntry={(tag) => {
              setDamId('')
              setDamTag(tag)
            }}
          />
          <ParentPicker
            id="edit-father"
            label="Father"
            animals={fathers}
            selectedId={sireId}
            onSelect={(id) => {
              const sire = fathers.find((animal) => animal.id === id)
              setSireId(id)
              setSireName(sire ? animalLabel(sire) : '')
            }}
            manualEntry={sireId ? '' : sireName}
            onManualEntry={(name) => {
              setSireId('')
              setSireName(name)
            }}
          />
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingPedigree} className="w-full sm:w-auto">
              {savingPedigree ? 'Saving...' : 'Save pedigree'}
            </Button>
          </div>
        </form>
      </CollapsibleCard>

      <CollapsibleCard
        title="Living place"
        description={
          placeDisplay === '—'
            ? 'Assign this animal to a location and camp.'
            : `Currently ${placeDisplay}.`
        }
        className="print:hidden"
      >
        <form onSubmit={handleSavePlace} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Location"
            id="detail-location"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setEncampmentId('')
            }}
          >
            <option value="">Not assigned</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </Select>
          <Select
            label="Camp"
            id="detail-encampment"
            value={encampmentId}
            onChange={(e) => setEncampmentId(e.target.value)}
            disabled={!locationId}
          >
            <option value="">{locationId ? 'Not assigned' : 'Select a location first'}</option>
            {campsForLocation.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {encampmentLabel(camp)}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingPlace} className="w-full sm:w-auto">
              {savingPlace ? 'Saving...' : 'Save living place'}
            </Button>
          </div>
        </form>
        {locations.length === 0 && (
          <p className="mt-3 text-sm text-soil-500">
            <Link to="/app/locations" className="font-semibold text-pasture-800 hover:text-pasture-700">
              Set up locations
            </Link>{' '}
            first, then add camps.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </CollapsibleCard>

      <CollapsibleCard
        title="Sale"
        description={
          formatSalePrice(animal.sale_price)
            ? `Sold for ${formatSalePrice(animal.sale_price)}${animal.sold_on ? ` on ${animal.sold_on}` : ''}${
                [animal.buyer_name, animal.buyer_surname].filter(Boolean).join(' ')
                  ? ` to ${[animal.buyer_name, animal.buyer_surname].filter(Boolean).join(' ')}`
                  : ''
              }.`
            : 'Record the price, buyer, and notes when this animal is sold.'
        }
        className="print:hidden"
      >
        <form onSubmit={handleSaveSale} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Sale price (R)"
            id="detail-sale-price"
            inputMode="decimal"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="15000"
            required
          />
          <Input
            label="Date sold"
            id="detail-sold-on"
            type="date"
            value={soldOn}
            onChange={(e) => setSoldOn(e.target.value)}
            required
          />
          <Input
            label="Buyer name"
            id="detail-buyer-name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Buyer surname"
            id="detail-buyer-surname"
            value={buyerSurname}
            onChange={(e) => setBuyerSurname(e.target.value)}
            placeholder="Optional"
          />
          <div className="md:col-span-2">
            <label htmlFor="detail-sale-notes" className="block text-sm font-semibold text-soil-700">
              Sale notes
            </label>
            <textarea
              id="detail-sale-notes"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={savingSale} className="w-full sm:w-auto">
              {savingSale ? 'Saving...' : 'Save sale'}
            </Button>
            {animal.sale_price != null && animal.sale_price !== '' && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={savingSale}
                onClick={() => void handleClearSale()}
              >
                Remove sale
              </Button>
            )}
          </div>
        </form>
        <p className="mt-3 text-sm text-soil-500">Saving a price marks this animal as sold.</p>
        {saleError && <p className="mt-3 text-sm text-red-600">{saleError}</p>}
        {saleSuccess && <p className="mt-3 text-sm text-pasture-800">{saleSuccess}</p>}
      </CollapsibleCard>

      <CollapsibleSection title="Breeding" className="print:hidden">
        <AnimalBreedingPanel
          animal={animal}
          companyId={profile.company_id}
          userId={profile.id}
          herdAnimals={herdAnimals}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Weight" className="print:hidden">
        <AnimalWeightsPanel
          animalId={animal.id}
          companyId={profile.company_id}
          userId={profile.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Health Records" className="print:hidden">
        <AnimalInoculationsPanel
          animalId={animal.id}
          companyId={profile.company_id}
          userId={profile.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Show Results" className="print:hidden">
        <AnimalAchievementsPanel
          animalId={animal.id}
          companyId={profile.company_id}
          userId={profile.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Documents" className="print:hidden">
        <AnimalDocumentsPanel
          animalId={animal.id}
          companyId={profile.company_id}
          userId={profile.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Photos" className="print:hidden">
        <AnimalPhotosPanel animalId={animal.id} companyId={profile.company_id} userId={profile.id} />
      </CollapsibleSection>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export interface SavedLocation {
  name: string
  lat: number
  lon: number
  extId?: string
}

interface StopResult {
  StopLocation?: { extId: string; name: string; lat: number; lon: number }
  CoordLocation?: { name: string; lat: number; lon: number; type: string }
}

function toLocation(item: StopResult): SavedLocation | null {
  if (item.StopLocation) {
    const s = item.StopLocation
    return { name: s.name, lat: s.lat, lon: s.lon, extId: s.extId }
  }
  if (item.CoordLocation) {
    const c = item.CoordLocation
    return { name: c.name, lat: c.lat, lon: c.lon }
  }
  return null
}

function LocationSearch({
  label,
  initial,
  onSelect,
}: {
  label: string
  initial: SavedLocation | null
  onSelect: (loc: SavedLocation) => void
}) {
  const [query, setQuery] = useState(initial?.name ?? '')
  const [results, setResults] = useState<SavedLocation[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SavedLocation | null>(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/stops?name=${encodeURIComponent(q)}`)
      const data = await res.json()
      const locations: SavedLocation[] = (data.stopLocationOrCoordLocation ?? [])
        .map(toLocation)
        .filter((x: SavedLocation | null): x is SavedLocation => x !== null)
      setResults(locations)
      setShowResults(true)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setSelected(null)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => doSearch(v), 300)
  }

  const pick = (loc: SavedLocation) => {
    setSelected(loc)
    onSelect(loc)
    setQuery(loc.name)
    setShowResults(false)
    setResults([])
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder="Sök adress eller hållplats..."
          className="w-full rounded-xl bg-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-600 focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <span className="absolute right-4 top-3.5 text-slate-400 text-xs">Söker...</span>
        )}
        {showResults && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-xl bg-slate-700 ring-1 ring-slate-600 shadow-xl overflow-hidden">
            {results.slice(0, 7).map((loc, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={() => pick(loc)}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-slate-600 border-b border-slate-600 last:border-0"
                >
                  <span>{loc.name}</span>
                  {!loc.extId && (
                    <span className="ml-2 text-xs text-slate-400">adress</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <p className="mt-1.5 text-xs text-green-400">✓ {selected.name}</p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [home, setHome] = useState<SavedLocation | null>(null)
  const [work, setWork] = useState<SavedLocation | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = localStorage.getItem('gonow_home')
    const w = localStorage.getItem('gonow_work')
    if (h) setHome(JSON.parse(h))
    if (w) setWork(JSON.parse(w))
  }, [])

  const save = () => {
    if (!home || !work) {
      setError('Välj både hemadress och jobbadress.')
      return
    }
    localStorage.setItem('gonow_home', JSON.stringify(home))
    localStorage.setItem('gonow_work', JSON.stringify(work))
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col max-w-md mx-auto px-5">
      <header className="flex items-center gap-3 pt-12 pb-8">
        <Link href="/" className="text-slate-400 hover:text-white text-xl">←</Link>
        <div>
          <h1 className="text-xl font-bold text-white">Adresser</h1>
          <p className="text-xs text-slate-400 mt-0.5">Sök adress eller hållplats</p>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <LocationSearch label="Hem" initial={home} onSelect={setHome} />
        <LocationSearch label="Jobb" initial={work} onSelect={setWork} />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={save}
          className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-500 active:bg-blue-700 transition-colors"
        >
          Spara
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SavedLocation } from './settings/page'

interface Weather {
  current: {
    temperature_2m: number
    apparent_temperature: number
    precipitation: number
    snowfall: number
    wind_speed_10m: number
    weather_code: number
  }
}

interface TripProduct {
  catOutS?: string
  num?: string
}

interface TripLeg {
  name: string
  type: string
  dist?: number
  Origin: { name: string; time: string; date: string }
  Destination: { name: string; time: string; date: string }
  Product?: TripProduct | TripProduct[]
}

interface Trip {
  LegList: { Leg: TripLeg | TripLeg[] }
}

type TimelineItem =
  | { kind: 'walk'; leg: TripLeg; label: string }
  | { kind: 'transit'; leg: TripLeg; transitType: string; lineNum: string }
  | { kind: 'stop'; name: string; time: string; isTransfer: boolean; waitMins?: number }

function fmtTime(t: string) { return t.slice(0, 5) }

function minutesBetween(fromTime: string, toTime: string, fromDate: string, toDate: string) {
  const [fh, fm] = fromTime.split(':').map(Number)
  const [th, tm] = toTime.split(':').map(Number)
  return th * 60 + tm + (fromDate !== toDate ? 1440 : 0) - (fh * 60 + fm)
}

function weatherLabel(code: number) {
  if (code === 0) return 'Klar himmel'
  if (code <= 2) return 'Lätt molnigt'
  if (code === 3) return 'Mulet'
  if (code <= 48) return 'Dimma'
  if (code <= 57) return 'Duggregn'
  if (code <= 67) return 'Regn'
  if (code <= 77) return 'Snö'
  if (code <= 82) return 'Regnskurar'
  if (code <= 86) return 'Snöbyar'
  return 'Åska'
}

function weatherIcon(code: number) {
  if (code === 0) return 'ti-sun'
  if (code <= 2) return 'ti-cloud-sun'
  if (code === 3) return 'ti-cloud'
  if (code <= 48) return 'ti-mist'
  if (code <= 67) return 'ti-cloud-rain'
  if (code <= 86) return 'ti-snowflake'
  return 'ti-cloud-storm'
}

function getTransitType(leg: TripLeg) {
  const product = Array.isArray(leg.Product) ? leg.Product[0] : leg.Product
  const cat = (product?.catOutS ?? '').toUpperCase()
  const name = leg.name.toLowerCase()
  if (cat === 'TRAM' || name.includes('spårvagn') || name.includes('tram')) return 'TRAM'
  if (cat === 'SUBWAY' || cat === 'METRO' || name.includes('tunnelbana') || name.includes('t-bana')) return 'METRO'
  if (name.includes('pendel') || name.includes('expresståg') || name.includes('regionaltåg') || name.includes('snabb')) return 'TRAIN'
  return 'BUS'
}

function getLegNumber(leg: TripLeg) {
  const product = Array.isArray(leg.Product) ? leg.Product[0] : leg.Product
  if (product?.num) return product.num
  const m = leg.name.match(/\d+/)
  return m ? m[0] : leg.name.slice(0, 3)
}

const BADGE: Record<string, string> = {
  BUS: 'bg-blue-600 text-blue-100',
  TRAM: 'bg-emerald-600 text-emerald-100',
  METRO: 'bg-red-600 text-red-100',
  TRAIN: 'bg-amber-500 text-amber-100',
}
const LINE: Record<string, string> = {
  BUS: 'bg-blue-500',
  TRAM: 'bg-emerald-500',
  METRO: 'bg-red-500',
  TRAIN: 'bg-amber-400',
}

function buildTimeline(legs: TripLeg[], originName: string, destName: string): TimelineItem[] {
  const items: TimelineItem[] = []
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]
    const next = legs[i + 1]
    if (leg.type === 'WALK') {
      const isFirst = i === 0
      items.push({ kind: 'walk', leg, label: isFirst ? `Gång från ${originName}` : `Gång till ${destName}` })
      if (next?.type === 'JNY') {
        items.push({ kind: 'stop', name: leg.Destination.name, time: leg.Destination.time, isTransfer: false })
      }
    } else if (leg.type === 'JNY') {
      const transitType = getTransitType(leg)
      const lineNum = getLegNumber(leg)
      if (i === 0) {
        items.push({ kind: 'stop', name: leg.Origin.name, time: leg.Origin.time, isTransfer: false })
      }
      items.push({ kind: 'transit', leg, transitType, lineNum })
      if (next?.type === 'JNY') {
        const waitMins = minutesBetween(leg.Destination.time, next.Origin.time, leg.Destination.date, next.Origin.date)
        items.push({ kind: 'stop', name: leg.Destination.name, time: leg.Destination.time, isTransfer: true, waitMins })
      } else if (next?.type === 'WALK') {
        items.push({ kind: 'stop', name: leg.Destination.name, time: leg.Destination.time, isTransfer: false })
      } else if (!next) {
        items.push({ kind: 'stop', name: leg.Destination.name, time: leg.Destination.time, isTransfer: false })
      }
    }
  }
  return items
}

function WeatherCard({ w, title, icon }: { w: Weather; title: string; icon: string }) {
  const c = w.current
  return (
    <div className="rounded-2xl bg-slate-800 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <i className={`ti ${icon} text-sm`} aria-hidden="true" />
        {title}
      </p>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-3xl font-bold text-white leading-none">{Math.round(c.temperature_2m)}°</p>
          <p className="text-sm text-slate-400 mt-1">Känns som {Math.round(c.apparent_temperature)}°</p>
        </div>
        <div className="text-right">
          <i className={`ti ${weatherIcon(c.weather_code)} text-2xl text-slate-300`} aria-hidden="true" />
          <p className="text-sm text-slate-300 mt-1">{weatherLabel(c.weather_code)}</p>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-sm text-slate-400">
        <span className="flex items-center gap-1">
          <i className="ti ti-wind text-sm" aria-hidden="true" />{Math.round(c.wind_speed_10m)} m/s
        </span>
        {c.precipitation > 0 && !c.snowfall && (
          <span className="flex items-center gap-1">
            <i className="ti ti-droplet text-sm" aria-hidden="true" />{c.precipitation} mm
          </span>
        )}
        {c.snowfall > 0 && (
          <span className="flex items-center gap-1">
            <i className="ti ti-snowflake text-sm" aria-hidden="true" />{c.snowfall} mm
          </span>
        )}
      </div>
    </div>
  )
}

function journeyParams(origin: SavedLocation, dest: SavedLocation) {
  const p = new URLSearchParams()
  if (origin.extId) p.set('originId', origin.extId)
  else { p.set('originLat', String(origin.lat)); p.set('originLon', String(origin.lon)); p.set('originName', origin.name) }
  if (dest.extId) p.set('destId', dest.extId)
  else { p.set('destLat', String(dest.lat)); p.set('destLon', String(dest.lon)); p.set('destName', dest.name) }
  return p.toString()
}

export default function Home() {
  const router = useRouter()
  const [home, setHome] = useState<SavedLocation | null>(null)
  const [work, setWork] = useState<SavedLocation | null>(null)
  const [direction, setDirection] = useState<'toWork' | 'toHome'>('toWork')
  const [originWeather, setOriginWeather] = useState<Weather | null>(null)
  const [arrivalWeather, setArrivalWeather] = useState<Weather | null>(null)
  const [journeys, setJourneys] = useState<Trip[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = localStorage.getItem('gonow_home')
    const w = localStorage.getItem('gonow_work')
    if (!h || !w) { router.push('/settings'); return }
    setHome(JSON.parse(h))
    setWork(JSON.parse(w))
    setDirection(new Date().getHours() < 13 ? 'toWork' : 'toHome')
  }, [router])

  const fetchAll = useCallback(async (h: SavedLocation, w: SavedLocation, dir: 'toWork' | 'toHome') => {
    setLoading(true)
    setError('')
    setJourneys([])
    setCurrentIndex(0)
    setOriginWeather(null)
    setArrivalWeather(null)
    const origin = dir === 'toWork' ? h : w
    try {
      const [wRes, jRes] = await Promise.all([
        fetch(`/api/weather?lat=${origin.lat}&lon=${origin.lon}`),
        fetch(`/api/journey?${journeyParams(origin, dir === 'toWork' ? w : h)}`),
      ])
      const [wData, jData] = await Promise.all([wRes.json(), jRes.json()])
      setOriginWeather(wData)
      setJourneys(jData.Trip ?? [])
    } catch {
      setError('Kunde inte hämta data. Kontrollera nätverket.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (home && work) fetchAll(home, work, direction)
  }, [home, work, direction, fetchAll])

  useEffect(() => {
    if (!home || !work || journeys.length === 0) return
    const dest = direction === 'toWork' ? work : home
    const trip = journeys[currentIndex]
    if (!trip) return
    const legs = Array.isArray(trip.LegList.Leg) ? trip.LegList.Leg : [trip.LegList.Leg]
    const lastLeg = legs[legs.length - 1]
    const hour = parseInt(lastLeg.Destination.time.slice(0, 2))
    setArrivalWeather(null)
    fetch(`/api/weather?lat=${dest.lat}&lon=${dest.lon}&hour=${hour}`)
      .then(r => r.json()).then(setArrivalWeather).catch(() => null)
  }, [journeys, currentIndex, home, work, direction])

  if (!home || !work) return null

  const origin = direction === 'toWork' ? home : work
  const dest = direction === 'toWork' ? work : home
  const currentTrip = journeys[currentIndex]
  const legs = currentTrip
    ? (Array.isArray(currentTrip.LegList.Leg) ? currentTrip.LegList.Leg : [currentTrip.LegList.Leg])
    : []
  const timeline = currentTrip ? buildTimeline(legs, origin.name, dest.name) : []
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]
  const totalMins = firstLeg && lastLeg
    ? minutesBetween(firstLeg.Origin.time, lastLeg.Destination.time, firstLeg.Origin.date, lastLeg.Destination.date)
    : 0

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col max-w-md mx-auto px-4">
      <header className="flex items-center justify-between pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">GoNow</h1>
        <Link href="/settings" className="text-slate-400 hover:text-white" aria-label="Inställningar">
          <i className="ti ti-settings text-xl" />
        </Link>
      </header>

      <button
        onClick={() => setDirection(d => d === 'toWork' ? 'toHome' : 'toWork')}
        className="flex items-center justify-between w-full rounded-xl bg-slate-800 px-4 py-3 mb-4 hover:bg-slate-700 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <i className={`ti ${direction === 'toWork' ? 'ti-home' : 'ti-building'} text-base text-slate-400`} aria-hidden="true" />
          {direction === 'toWork' ? home?.name ?? 'Hem' : work?.name ?? 'Jobb'}
        </span>
        <i className="ti ti-arrows-exchange text-slate-400 text-lg" aria-hidden="true" />
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          {direction === 'toWork' ? work?.name ?? 'Jobb' : home?.name ?? 'Hem'}
          <i className={`ti ${direction === 'toWork' ? 'ti-building' : 'ti-home'} text-base text-slate-400`} aria-hidden="true" />
        </span>
      </button>

      <div className="flex flex-col gap-3 pb-8">

        {/* Väder nu */}
        {originWeather
          ? <WeatherCard w={originWeather} title={origin.name} icon="ti-map-pin" />
          : <div className="rounded-2xl bg-slate-800 p-4 text-slate-400 text-sm">{loading ? 'Hämtar väder...' : 'Väder ej tillgängligt'}</div>
        }

        {/* Resekortet */}
        <div className="rounded-2xl bg-slate-800 overflow-hidden">

          {/* Navigering */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0 || loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
              aria-label="Tidigare avgång"
            >
              <i className="ti ti-chevron-left text-lg" />
            </button>

            <div className="text-center">
              {loading && <p className="text-slate-400 text-sm">Hämtar avgångar...</p>}
              {!loading && !currentTrip && <p className="text-slate-400 text-sm">Inga avgångar</p>}
              {!loading && currentTrip && (
                <>
                  <p className="text-base font-bold text-white">Avgång {fmtTime(firstLeg.Origin.time)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Framme {fmtTime(lastLeg.Destination.time)} · {totalMins} min</p>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentIndex(i => Math.min(journeys.length - 1, i + 1))}
              disabled={currentIndex >= journeys.length - 1 || loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 text-white disabled:opacity-30 hover:bg-slate-600 transition-colors"
              aria-label="Nästa avgång"
            >
              <i className="ti ti-chevron-right text-lg" />
            </button>
          </div>

          {/* Paginerings-prickar */}
          {journeys.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-2.5 pb-1">
              {journeys.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`rounded-full transition-colors ${i === currentIndex ? 'w-3 h-1.5 bg-blue-500' : 'w-1.5 h-1.5 bg-slate-600 hover:bg-slate-500'}`}
                  aria-label={`Avgång ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Tidslinje */}
          {!loading && currentTrip && (
            <div className="px-4 pt-3 pb-4">
              {timeline.map((item, i) => {
                const isLast = i === timeline.length - 1

                if (item.kind === 'walk') {
                  const mins = minutesBetween(item.leg.Origin.time, item.leg.Destination.time, item.leg.Origin.date, item.leg.Destination.date)
                  const isFirst = item.label.startsWith('Gång från')
                  return (
                    <div key={i} className="flex gap-3 items-stretch">
                      <div className="flex flex-col items-center w-8 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                          <i className={`ti ${isFirst ? 'ti-home' : 'ti-building'} text-sm text-slate-300`} aria-hidden="true" />
                        </div>
                        {!isLast && <div className="w-0.5 flex-1 bg-slate-600 mt-1 min-h-3" />}
                      </div>
                      <div className="flex-1 pt-1 pb-3">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {mins} min{item.leg.dist ? ` · ${item.leg.dist} m` : ''}
                        </p>
                      </div>
                    </div>
                  )
                }

                if (item.kind === 'transit') {
                  const lineClass = LINE[item.transitType] ?? 'bg-blue-500'
                  const badgeClass = BADGE[item.transitType] ?? BADGE.BUS
                  const mins = minutesBetween(item.leg.Origin.time, item.leg.Destination.time, item.leg.Origin.date, item.leg.Destination.date)
                  return (
                    <div key={i} className="flex gap-3 items-stretch">
                      <div className="flex flex-col items-center w-8 flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeClass}`}>
                          {item.lineNum}
                        </div>
                        {!isLast && <div className={`w-0.5 flex-1 mt-1 min-h-3 ${lineClass}`} />}
                      </div>
                      <div className="flex-1 pt-1 pb-3">
                        <p className="text-sm font-medium text-white">{item.leg.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmtTime(item.leg.Origin.time)} → {fmtTime(item.leg.Destination.time)}
                          <span className="text-slate-500"> · {mins} min</span>
                        </p>
                      </div>
                    </div>
                  )
                }

                if (item.kind === 'stop') {
                  const dotColor = item.isTransfer ? 'bg-amber-400 border-amber-300' : 'bg-blue-400 border-blue-300'
                  const nextItem = timeline[i + 1]
                  const nextLineColor = nextItem?.kind === 'transit' ? (LINE[nextItem.transitType] ?? 'bg-slate-600') : 'bg-slate-600'
                  return (
                    <div key={i} className="flex gap-3 items-stretch">
                      <div className="flex flex-col items-center w-8 flex-shrink-0">
                        <div className="w-8 h-5 flex items-center justify-center flex-shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full border-2 ${dotColor}`} />
                        </div>
                        {!isLast && <div className={`w-0.5 flex-1 min-h-2 ${nextLineColor}`} />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-slate-400">
                          {item.name}{' '}
                          <span className="text-white font-medium">{fmtTime(item.time)}</span>
                          {item.isTransfer && item.waitMins != null && (
                            <span className="text-amber-400"> · byte {item.waitMins} min</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                }
              })}

              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Väder vid framkomst */}
        {arrivalWeather && lastLeg
          ? <WeatherCard
              w={arrivalWeather}
              title={`${dest.name} · ${fmtTime(lastLeg.Destination.time)}`}
              icon="ti-building-skyscraper"
            />
          : journeys.length > 0 && !loading && (
            <div className="rounded-2xl bg-slate-800 p-4 text-slate-400 text-sm">Hämtar ankomstväder...</div>
          )
        }

        <button
          onClick={() => home && work && fetchAll(home, work, direction)}
          disabled={loading}
          className="text-slate-400 text-sm text-center hover:text-white disabled:opacity-40 transition-colors py-2"
        >
          {loading ? 'Uppdaterar...' : '↻ Uppdatera'}
        </button>

      </div>
    </div>
  )
}

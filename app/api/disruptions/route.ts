import { NextRequest, NextResponse } from 'next/server'

interface Deviation {
  LineNumber?: string | number
  Header?: string
  ShortDescription?: string
  Details?: string
  Description?: string
  ScopeElements?: string
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.SL_DEVIATIONS_KEY
  if (!apiKey) return NextResponse.json({ deviations: [] })

  const { searchParams } = new URL(request.url)
  const lines = searchParams.get('lines')

  const url = new URL('https://api.sl.se/api2/deviations.json')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('transportMode', 'bus,metro,train,tram')

  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) return NextResponse.json({ deviations: [] })

  const data = await res.json()
  if (data.StatusCode !== 0) return NextResponse.json({ deviations: [] })

  const rd = data.ResponseData
  const all: Deviation[] = [
    ...(rd.TrainDeviations ?? []),
    ...(rd.BusDeviations ?? []),
    ...(rd.TvDeviations ?? []),
    ...(rd.ShipDeviations ?? []),
  ]

  const lineSet = lines ? new Set(lines.split(',').map(l => l.trim())) : null
  const filtered = lineSet
    ? all.filter(d => lineSet.has(String(d.LineNumber ?? '')))
    : all.slice(0, 3)

  return NextResponse.json({
    deviations: filtered.map(d => ({
      header: d.Header ?? d.ShortDescription ?? '',
      details: d.Details ?? d.Description ?? '',
      scope: d.ScopeElements ?? '',
      lineNumber: d.LineNumber,
    }))
  })
}

import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

export const runtime = 'nodejs'

type Translation = { language?: string | null; text: string }
type InformedEntity = { routeId?: string | null }
type Alert = {
  activePeriod?: { start?: number | Long | null; end?: number | Long | null }[]
  headerText?: { translation?: Translation[] | null } | null
  descriptionText?: { translation?: Translation[] | null } | null
  informedEntity?: InformedEntity[] | null
}
type Long = { toNumber(): number }

function sv(translations: Translation[] | null | undefined) {
  return translations?.find(t => t.language === 'sv')?.text ?? translations?.[0]?.text ?? ''
}

function matchesLines(alert: Alert, lineNumbers: string[]): boolean {
  const text = `${sv(alert.headerText?.translation)} ${sv(alert.descriptionText?.translation)}`
  return lineNumbers.some(ln => {
    // Match the line number in human-readable text only.
    // Exclude digit or colon before the number to avoid matching times like "15:41" as line "41".
    return new RegExp(`(?<![:\\d])${ln.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`).test(text)
  })
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GTFS_RT_KEY
  if (!apiKey) return NextResponse.json({ deviations: [] })

  const { searchParams } = new URL(request.url)
  const linesParam = searchParams.get('lines')
  const lineNumbers = linesParam ? linesParam.split(',').map(l => l.trim()).filter(Boolean) : null

  const res = await fetch(
    `https://opendata.samtrafiken.se/gtfs-rt/sl/ServiceAlerts.pb?key=${apiKey}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return NextResponse.json({ deviations: [] })

  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(await res.arrayBuffer())
  )

  const now = Math.floor(Date.now() / 1000)

  const alerts = feed.entity
    .filter(e => e.alert)
    .filter(e => {
      const periods = e.alert!.activePeriod ?? []
      if (periods.length === 0) return true
      return periods.some(p => {
        const start = p.start != null ? (typeof p.start === 'object' ? (p.start as Long).toNumber() : Number(p.start)) : 0
        const end = p.end != null ? (typeof p.end === 'object' ? (p.end as Long).toNumber() : Number(p.end)) : 0
        return start <= now && (end === 0 || end >= now)
      })
    })
    .filter(e => !lineNumbers || matchesLines(e.alert! as Alert, lineNumbers))
    .map(e => ({
      header: sv(e.alert!.headerText?.translation),
      details: sv(e.alert!.descriptionText?.translation),
    }))
    .filter(a => a.header)

  return NextResponse.json({ deviations: alerts.slice(0, 5) })
}

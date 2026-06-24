import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  const apiKey = process.env.GTFS_RT_KEY
  if (!apiKey) return NextResponse.json({ deviations: [] })

  const url = `https://opendata.samtrafiken.se/gtfs-rt/sl/ServiceAlerts.pb?key=${apiKey}`

  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return NextResponse.json({ deviations: [] })

  const buffer = await res.arrayBuffer()
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer))

  const now = Math.floor(Date.now() / 1000)

  const sv = (translations: { language?: string | null; text: string }[] | null | undefined) =>
    translations?.find(t => t.language === 'sv')?.text ?? translations?.[0]?.text ?? ''

  const alerts = feed.entity
    .filter(e => e.alert)
    .filter(e => {
      const periods = e.alert!.activePeriod ?? []
      if (periods.length === 0) return true
      return periods.some(p => {
        const start = p.start != null ? Number(p.start) : 0
        const end = p.end != null ? Number(p.end) : 0
        return start <= now && (end === 0 || end >= now)
      })
    })
    .map(e => ({
      header: sv(e.alert!.headerText?.translation),
      details: sv(e.alert!.descriptionText?.translation),
    }))
    .filter(a => a.header)

  return NextResponse.json({ deviations: alerts.slice(0, 5) })
}

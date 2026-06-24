import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const apiKey = process.env.RESROBOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API-nyckel saknas i .env.local' }, { status: 500 })
  }

  const url = new URL('https://api.resrobot.se/v2.1/trip')
  url.searchParams.set('format', 'json')
  url.searchParams.set('accessId', apiKey)
  url.searchParams.set('numF', '6')

  const originId = searchParams.get('originId')
  const originLat = searchParams.get('originLat')
  const originLon = searchParams.get('originLon')
  const originName = searchParams.get('originName')

  if (originId) {
    url.searchParams.set('originId', originId)
  } else if (originLat && originLon) {
    url.searchParams.set('originCoordLat', originLat)
    url.searchParams.set('originCoordLong', originLon)
    if (originName) url.searchParams.set('originCoordName', originName)
  } else {
    return NextResponse.json({ error: 'Saknar origin-parametrar' }, { status: 400 })
  }

  const destId = searchParams.get('destId')
  const destLat = searchParams.get('destLat')
  const destLon = searchParams.get('destLon')
  const destName = searchParams.get('destName')

  if (destId) {
    url.searchParams.set('destId', destId)
  } else if (destLat && destLon) {
    url.searchParams.set('destCoordLat', destLat)
    url.searchParams.set('destCoordLong', destLon)
    if (destName) url.searchParams.set('destCoordName', destName)
  } else {
    return NextResponse.json({ error: 'Saknar dest-parametrar' }, { status: 400 })
  }

  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    return NextResponse.json({ error: 'Resplaneraren svarade inte' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}

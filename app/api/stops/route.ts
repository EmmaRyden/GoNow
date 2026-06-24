import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'Saknar name-parameter' }, { status: 400 })
  }

  const apiKey = process.env.RESROBOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API-nyckel saknas i .env.local' }, { status: 500 })
  }

  const url = new URL('https://api.resrobot.se/v2.1/location.name')
  url.searchParams.set('input', name)
  url.searchParams.set('format', 'json')
  url.searchParams.set('accessId', apiKey)
  url.searchParams.set('maxNo', '10')

  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    return NextResponse.json({ error: 'Söktjänsten svarade inte' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}

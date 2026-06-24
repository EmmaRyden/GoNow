import { NextRequest, NextResponse } from 'next/server'

const FIELDS = 'temperature_2m,apparent_temperature,precipitation,snowfall,wind_speed_10m,weather_code'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Saknar lat/lon' }, { status: 400 })
  }

  const hourParam = searchParams.get('hour')

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('timezone', 'Europe/Stockholm')
  url.searchParams.set('forecast_days', '1')

  if (hourParam !== null) {
    url.searchParams.set('hourly', FIELDS)
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) return NextResponse.json({ error: 'Vädertjänsten svarade inte' }, { status: 502 })
    const data = await res.json()
    const h = Math.min(23, Math.max(0, parseInt(hourParam)))
    return NextResponse.json({
      current: {
        temperature_2m: data.hourly.temperature_2m[h],
        apparent_temperature: data.hourly.apparent_temperature[h],
        precipitation: data.hourly.precipitation[h],
        snowfall: data.hourly.snowfall[h],
        wind_speed_10m: data.hourly.wind_speed_10m[h],
        weather_code: data.hourly.weather_code[h],
      },
    })
  }

  url.searchParams.set('current', FIELDS)
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) return NextResponse.json({ error: 'Vädertjänsten svarade inte' }, { status: 502 })
  const data = await res.json()
  return NextResponse.json(data)
}

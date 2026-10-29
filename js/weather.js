const WMO = {
  0: 'Ciel clair',
  1: 'Principalement clair',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine',
  55: 'Bruine forte',
  61: 'Pluie légère',
  63: 'Pluie',
  65: 'Pluie forte',
  71: 'Neige légère',
  73: 'Neige',
  75: 'Neige forte',
  80: 'Averses légères',
  81: 'Averses',
  82: 'Averses fortes',
  95: 'Orage',
  96: 'Orage grêle',
  99: 'Orage grêle forte'
};

export function weatherCodeLabel(code) {
  return WMO[code] || `Code ${code}`;
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation indisponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000
    });
  });
}

export async function fetchOpenMeteo(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Météo indisponible');
  const data = await res.json();
  const c = data.current;
  if (!c) throw new Error('Réponse météo invalide');

  return {
    source: 'gps',
    tempC: c.temperature_2m,
    windKmh: c.wind_speed_10m,
    humidity: c.relative_humidity_2m,
    condition: weatherCodeLabel(c.weather_code),
    weatherCode: c.weather_code,
    lat,
    lon,
    fetchedAt: new Date().toISOString()
  };
}

export async function fetchWeatherFromGps() {
  const pos = await getCurrentPosition();
  const { latitude, longitude } = pos.coords;
  return fetchOpenMeteo(latitude, longitude);
}

export function manualWeather({ tempC, windKmh, humidity, condition }) {
  return {
    source: 'manual',
    tempC: tempC === '' || tempC == null ? null : Number(tempC),
    windKmh: windKmh === '' || windKmh == null ? null : Number(windKmh),
    humidity: humidity === '' || humidity == null ? null : Number(humidity),
    condition: condition || '',
    fetchedAt: new Date().toISOString()
  };
}

export function formatWeather(w) {
  if (!w) return 'Non renseignée';
  const parts = [];
  if (w.tempC != null) parts.push(`${w.tempC}°C`);
  if (w.humidity != null) parts.push(`${w.humidity}% hum.`);
  if (w.windKmh != null) parts.push(`${w.windKmh} km/h`);
  if (w.condition) parts.push(w.condition);
  const src = w.source === 'gps' ? 'GPS' : 'manuel';
  return parts.length ? `${parts.join(' · ')} (${src})` : `— (${src})`;
}

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export function haversineMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3;
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export async function isLikelyMockedPosition(_pos: GeoPosition): Promise<{ mocked: boolean; reasons: string[] }> {
  return { mocked: false, reasons: [] };
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    let isDone = false;

    const safetyTimer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        reject(new Error("GPS request timed out. Please check your location settings."));
      }
    }, 15000);

    const onSuccess = (p: GeolocationPosition) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(safetyTimer);
      resolve({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      });
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => {
        if (isDone) return;
        
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => {
            if (isDone) return;
            isDone = true;
            clearTimeout(safetyTimer);
            
            if (err2.code === 1) {
              reject(new Error("Permission denied. Please allow location access."));
            } else {
              reject(new Error("Unable to determine location. Please ensure GPS is enabled."));
            }
          },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  });
}

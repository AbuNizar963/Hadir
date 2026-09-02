import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LocationPickerProps = {
  lat: number;
  lng: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
};

const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export default function LocationPicker({ lat, lng, radiusMeters, onChange, className = "" }: LocationPickerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const radiusRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const safeLat = Number.isFinite(lat) ? lat : 24.7136;
    const safeLng = Number.isFinite(lng) ? lng : 46.6753;
    const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView([safeLat, safeLng], 18);
    L.tileLayer(SATELLITE_URL, {
      maxZoom: 20,
      attribution: "© Esri, Maxar, Earthstar Geographics"
    }).addTo(map);

    const marker = L.circleMarker([safeLat, safeLng], {
      radius: 9,
      weight: 3,
      fillOpacity: 0.9,
      draggable: false
    }).addTo(map);
    const radius = L.circle([safeLat, safeLng], {
      radius: Math.max(1, Number(radiusMeters) || 100),
      weight: 2,
      fillOpacity: 0.12
    }).addTo(map);

    const select = (event: L.LeafletMouseEvent) => {
      const nextLat = Number(event.latlng.lat.toFixed(7));
      const nextLng = Number(event.latlng.lng.toFixed(7));
      marker.setLatLng([nextLat, nextLng]);
      radius.setLatLng([nextLat, nextLng]);
      onChangeRef.current(nextLat, nextLng);
    };
    map.on("click", select);

    mapRef.current = map;
    markerRef.current = marker;
    radiusRef.current = radius;

    const resize = () => map.invalidateSize();
    window.setTimeout(resize, 80);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      radiusRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const radius = radiusRef.current;
    if (!map || !marker || !radius || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const center: L.LatLngExpression = [lat, lng];
    marker.setLatLng(center);
    radius.setLatLng(center);
    radius.setRadius(Math.max(1, Number(radiusMeters) || 100));
    const current = map.getCenter();
    if (Math.abs(current.lat - lat) > 0.000001 || Math.abs(current.lng - lng) > 0.000001) map.setView(center, Math.max(map.getZoom(), 18), { animate: false });
  }, [lat, lng, radiusMeters]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-border/70 bg-muted/20 ${className}`}>
      <div ref={hostRef} className="h-64 w-full sm:h-80" aria-label="خريطة القمر الصناعي لتحديد الموقع" />
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/90 px-3 py-2 text-[10px] text-muted-foreground">
        <span>اضغط على الخريطة لتحديد النقطة بدقة</span>
        <span className="mono">{Number.isFinite(lat) ? lat.toFixed(6) : "—"}, {Number.isFinite(lng) ? lng.toFixed(6) : "—"}</span>
      </div>
    </div>
  );
}

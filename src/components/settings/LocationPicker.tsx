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
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    let started = false;
    let observer: IntersectionObserver | null = null;

    const initMap = () => {
      if (started || !host.isConnected || mapRef.current) return;
      started = true;

      const safeLat = Number.isFinite(lat) ? lat : 24.7136;
      const safeLng = Number.isFinite(lng) ? lng : 46.6753;
      const map = L.map(host, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      }).setView([safeLat, safeLng], 16);

      L.tileLayer(SATELLITE_URL, {
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 0,
        updateWhenIdle: true,
        updateWhenZooming: false,
        detectRetina: false,
        attribution: "© Esri, Maxar, Earthstar Geographics",
      }).addTo(map);

      const marker = L.circleMarker([safeLat, safeLng], { radius: 9, weight: 3, fillOpacity: 0.9 }).addTo(map);
      const radius = L.circle([safeLat, safeLng], { radius: Math.max(1, Number(radiusMeters) || 100), weight: 2, fillOpacity: 0.12 }).addTo(map);

      map.on("click", (event: L.LeafletMouseEvent) => {
        const nextLat = Number(event.latlng.lat.toFixed(7));
        const nextLng = Number(event.latlng.lng.toFixed(7));
        marker.setLatLng([nextLat, nextLng]);
        radius.setLatLng([nextLat, nextLng]);
        onChangeRef.current(nextLat, nextLng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      radiusRef.current = radius;

      const resize = () => map.invalidateSize({ pan: false });
      window.setTimeout(resize, 0);
      window.setTimeout(resize, 120);
      window.addEventListener("resize", resize);

      observer?.disconnect();
      observer = null;

      const cleanup = () => {
        window.removeEventListener("resize", resize);
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
        radiusRef.current = null;
      };

      host.dataset.leafletCleanup = "1";
      (host as HTMLDivElement & { __leafletCleanup?: () => void }).__leafletCleanup = cleanup;
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) initMap();
      }, { rootMargin: "160px" });
      observer.observe(host);
    } else {
      initMap();
    }

    return () => {
      observer?.disconnect();
      const cleanupHost = host as HTMLDivElement & { __leafletCleanup?: () => void };
      cleanupHost.__leafletCleanup?.();
      delete cleanupHost.__leafletCleanup;
      delete host.dataset.leafletCleanup;
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

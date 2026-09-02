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

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "© Esri, Maxar, Earthstar Geographics";

function validCoordinate(lat: unknown, lng: unknown): boolean {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

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
    let disposed = false;
    let observer: IntersectionObserver | null = null;

    const locateControl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd(map: L.Map) {
        const button = L.DomUtil.create("button", "hadir-map-location-control");
        button.type = "button";
        button.title = "تحديد موقعي";
        button.setAttribute("aria-label", "تحديد موقعي");
        button.innerHTML = "<span aria-hidden=\"true\">⌾</span>";
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.stop(event);
          if (!("geolocation" in navigator)) return;
          button.disabled = true;
          button.setAttribute("aria-busy", "true");
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!disposed) {
                map.setView([position.coords.latitude, position.coords.longitude], Math.max(map.getZoom(), 17), { animate: true });
              }
              button.disabled = false;
              button.removeAttribute("aria-busy");
            },
            () => {
              button.disabled = false;
              button.removeAttribute("aria-busy");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          );
        });
        return button;
      },
    });

    const initMap = async () => {
      if (started || disposed || !host.isConnected || mapRef.current) return;
      started = true;
      try {
        if (disposed || !host.isConnected || mapRef.current) return;

        // The coordinates supplied by the settings editor are authoritative.
        // This is important when editing a branch/location: never replace its
        // coordinates with the company's main location while the map loads.
        const initialLat = Number(lat);
        const initialLng = Number(lng);
        const initialRadius = Number(radiusMeters);

        if (!validCoordinate(initialLat, initialLng)) {
          console.warn("إحداثيات الموقع المحدد غير صالحة؛ لن يتم فتح الخريطة على موقع افتراضي.");
          started = false;
          return;
        }

        const map = L.map(host, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
          minZoom: 2,
          maxZoom: 19,
          worldCopyJump: true,
        }).setView([initialLat, initialLng], 16);

        L.tileLayer(SATELLITE_TILES, {
          attribution: SATELLITE_ATTRIBUTION,
          maxZoom: 19,
          maxNativeZoom: 19,
          crossOrigin: true,
        }).addTo(map);

        new locateControl().addTo(map);

        const marker = L.circleMarker([initialLat, initialLng], {
          radius: 9,
          weight: 3,
          fillOpacity: 0.9,
        }).addTo(map);
        const radius = L.circle([initialLat, initialLng], {
          radius: Math.max(1, Number.isFinite(initialRadius) ? initialRadius : 100),
          weight: 2,
          fillOpacity: 0.12,
        }).addTo(map);

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
        (host as HTMLDivElement & { __leafletCleanup?: () => void }).__leafletCleanup = cleanup;
      } catch (error) {
        console.warn("تعذر تحميل خريطة القمر الصناعي لتحديد الموقع:", error);
        started = false;
      }
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void initMap();
      }, { rootMargin: "160px" });
      observer.observe(host);
    } else {
      void initMap();
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      const cleanupHost = host as HTMLDivElement & { __leafletCleanup?: () => void };
      cleanupHost.__leafletCleanup?.();
      delete cleanupHost.__leafletCleanup;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const radius = radiusRef.current;
    if (!map || !marker || !radius || !validCoordinate(lat, lng)) return;
    const center: L.LatLngExpression = [Number(lat), Number(lng)];
    marker.setLatLng(center);
    radius.setLatLng(center);
    radius.setRadius(Math.max(1, Number(radiusMeters) || 100));
    map.setView(center, Math.max(map.getZoom(), 16), { animate: false });
  }, [lat, lng, radiusMeters]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-border/70 bg-muted/20 ${className}`}>
      <style>{`
        .hadir-map-location-control {
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 9999px;
          background: rgba(255,255,255,.96);
          box-shadow: 0 2px 10px rgba(0,0,0,.25);
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #1f2937;
          font-size: 22px;
          line-height: 1;
        }
        .hadir-map-location-control:hover { background: #fff; transform: scale(1.04); }
        .hadir-map-location-control:disabled { opacity: .6; cursor: wait; }
      `}</style>
      <div ref={hostRef} className="h-64 w-full sm:h-80" aria-label="خريطة القمر الصناعي لتحديد الموقع" />
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/90 px-3 py-2 text-[10px] text-muted-foreground">
        <span>اضغط زر ⌾ لتحديد موقعك، أو اضغط على الخريطة لاختيار النقطة</span>
        <span className="mono">{validCoordinate(lat, lng) ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "—"}</span>
      </div>
    </div>
  );
}

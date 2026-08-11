import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '../../domain';

const markerIcon = L.divIcon({ className: 'placeMarker', html: '<span>♥</span>', iconSize: [34, 42], iconAnchor: [17, 42] });

export function MapCanvas({ places, selectedId, select }: { places: Place[]; selectedId: number | null; select: (id: number) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!element.current || map.current) return;
    map.current = L.map(element.current, { zoomControl: false }).setView([12.8797, 121.774], 5);
    L.control.zoom({ position: 'topright' }).addTo(map.current);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const coordinates: L.LatLngExpression[] = [];
    places.forEach((place) => {
      if (place.latitude == null || place.longitude == null) return;
      const position: L.LatLngExpression = [place.latitude, place.longitude]; coordinates.push(position);
      L.marker(position, { icon: markerIcon, opacity: selectedId && selectedId !== place.id ? .55 : 1 })
        .bindTooltip(place.name, { direction: 'top' }).on('click', () => select(place.id)).addTo(layer.current!);
    });
    if (coordinates.length) map.current.fitBounds(L.latLngBounds(coordinates).pad(.2), { maxZoom: 14 });
  }, [places, selectedId, select]);
  return <div className="mapCanvas" ref={element} />;
}

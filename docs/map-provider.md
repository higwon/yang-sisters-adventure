# Map provider policy

The map uses Leaflet with the public OpenStreetMap Standard tile layer. The UI always displays OpenStreetMap attribution and does not require a billing-enabled map API.

Production rules:

- Do not remove or obscure the OpenStreetMap attribution.
- Do not prefetch, bulk-download, scrape, or provide offline tile downloads.
- Keep normal browser caching enabled and avoid cache-busting tile URLs.
- Use the map only for this small, trusted-group application. If traffic grows materially, move to a provider or self-hosted tile service whose capacity and terms fit that traffic.
- Coordinates are entered and stored with Place data. This app does not send bulk geocoding requests to OpenStreetMap services.

Review the current [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before changing the provider or request behavior.

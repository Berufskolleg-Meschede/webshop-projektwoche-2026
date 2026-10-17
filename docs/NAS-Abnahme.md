# NAS-Abnahme (Synology) – Checkliste

Ziel: Der Container läuft auf der Synology, Webshop **und** Simulation sind im Schul-WLAN erreichbar, QR-Codes funktionieren.

## 0. Vorbereitung

- `docker-compose.yml` auf der NAS (Netzwerk `SmartFactory`, Port `51020:8080`, Traefik-Labels, Watchtower). In der `.env` neben der Compose-Datei: `WEBSHOP_HOST=<Hostname für Traefik>`.
- `CORS_ORIGINS` **leer lassen** (gleiche Origin). `VITE_PUBLIC_BASE_URL` wird beim Image-Build/Start nicht benötigt, solange das Dashboard über die NAS-Adresse geöffnet wird.
- LAN-Adresse der NAS: `http://<nas-lan-ip>:51020` (oder der Traefik-Host).

## 1. Automatischer Teil (von einem Laptop im Schul-WLAN)

```bash
scripts/nas-smoke-test.sh http://<nas-lan-ip>:51020
```

Erwartung: `All checks passed.` (Health, SPA + QR-Deep-Link, Session-Lebenszyklus, 409-Claim mit Namen, Config-Sperre, Bestellung nach Start 409, Reset behält Claims).

## 2. Manueller Teil (Handy im Schul-WLAN)

- [ ] `http://<nas-lan-ip>:51020/` öffnet den Webshop; `/health` zeigt `{"status":"ok"}`.
- [ ] Dashboard am Laptop über **dieselbe NAS-Adresse** öffnen (nicht `localhost`!), Session erstellen, _QR-Code anzeigen_ → Handy scannt: richtige Rolle öffnet sich.
- [ ] Zwei Handys, gleiche Station: das zweite bekommt „Station ist bereits von <Name> belegt."
- [ ] Kunde scannt Kunden-QR → Shop mit Simulations-Banner → Bestellung erscheint live im Dashboard.
- [ ] Tag simulieren → Stationen reagieren innerhalb von ~2 s.
- [ ] Traefik: Aufruf über `http://<WEBSHOP_HOST>/` funktioniert (falls Traefik genutzt wird).
- [ ] Watchtower zieht ein neues Image (nach Push auf `main`, ca. 1–2 Min.).

## 3. Betriebshinweise

- **Sessions liegen im Arbeitsspeicher.** Ein Container-Neustart (auch durch Watchtower!) beendet laufende Sessions → Image-Updates nicht während des Unterrichts einspielen; vor dem Unterricht starten, nicht mittendrin neu starten.
- Genau **ein** Container/Prozess (kein Skalieren).
- Hängt ein Gerät nach einem Tab-Wechsel, einfach neu laden: der Claim bleibt erhalten.

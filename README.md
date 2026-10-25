# Local Backup Tracker

Schlanke Web-App, die zeigt, welche Docker-Compose-Stacks vom
Backup-Script (`docker-stack-backup.sh`, per Cron) gesichert werden — und
welche nicht. Läuft als einzelner Docker-Container, keine Datenbank — die
einzigen gespeicherten Daten (Admin-Konto, „kein Backup nötig"-Markierungen)
liegen als YAML unter `data/`.

Jeder Stack bekommt einen von drei Status:

| Status | Bedeutung |
|---|---|
| **gesichert** (grün) | Es gibt eine aktive Crontab-Zeile, die `docker-stack-backup.sh <stack-pfad>` aufruft |
| **kein Backup nötig** | Vom Admin bewusst ausgenommen (jederzeit zurücknehmbar) |
| **Entscheidung offen** (gelb hervorgehoben) | Weder gesichert noch ausgenommen |

Dazu eine kleine API (`/api/status`) für das
[Homepage](https://gethomepage.dev)-Dashboard.

## Tech-Stack

Gleicher Aufbau wie der mTLS Certificate Manager: Node.js 22, Express,
EJS (Server-Side-Rendering, kein SPA), `js-yaml`, `argon2`.

## Wie wird erkannt, was gesichert wird?

- **Stacks:** jeder Unterordner direkt in `STACKS_DIR`, der eine
  `compose.yaml`, `compose.yml`, `docker-compose.yaml` oder
  `docker-compose.yml` enthält (Dockge-Layout). Ob der Stack läuft, spielt
  keine Rolle.
- **Backups:** alle Zeilen in `CRONTAB_PATH` (Datei oder Verzeichnis), die
  `BACKUP_SCRIPT_NAME` aufrufen. Das Argument dahinter ist der Stack-Pfad.
  Auskommentierte Zeilen (`#…`) zählen nicht. Funktioniert mit
  User-Crontab-Format und mit `/etc/cron.d`-Format (mit User-Spalte).
- **Zuordnung:** Ist `HOST_STACKS_DIR` gesetzt, muss der Pfad in der Crontab
  genau `HOST_STACKS_DIR/<stack>` sein. Ohne `HOST_STACKS_DIR` wird nur
  der letzte Pfadteil verglichen.
- Crontab-Einträge, zu denen es keinen Stack-Ordner (mehr) gibt, werden
  oben als Warnung angezeigt.
- Wird ein als „kein Backup nötig" markierter Stack später in die Crontab
  aufgenommen, wird die Markierung automatisch entfernt.

Alles wird bei jedem Seitenaufruf bzw. API-Call neu eingelesen — kein
Cache, kein Hintergrund-Job.

## Crontab

Die Root-Crontab (`/var/spool/cron/crontabs/root`, Rechte `600`) kann der
Container nicht lesen, weil er nicht als root läuft. Empfohlen: die
Backup-Zeilen nach `/etc/cron.d/docker-stack-backup` verschieben. Dort ist
eine zusätzliche **User-Spalte** nötig:

```cron
0 3 */2 * * root /usr/local/bin/docker-stack-backup.sh /home/legend9080/stacks/Proxmox-internal/homeassistant >> /var/log/docker-backup.log 2>&1
0 3 */2 * * root /usr/local/bin/docker-stack-backup.sh /home/legend9080/stacks/Proxmox-internal/cloud >> /var/log/docker-backup.log 2>&1
```

Datei muss `root` gehören, Rechte `644`, Dateiname ohne Punkt. Danach die
alten Zeilen aus `crontab -e` entfernen.

Gemountet wird das **ganze Verzeichnis** `/etc/cron.d`, nicht die einzelne
Datei: Editoren wie vim speichern über eine neue Datei (neuer Inode), und ein
Bind-Mount auf eine einzelne Datei würde bis zum Container-Neustart den alten
Inhalt zeigen. Andere Dateien in `/etc/cron.d` stören nicht, es zählen nur
Zeilen mit dem Backup-Script.

## Homepage-Widget

`GET /api/status` mit Header `X-API-Key: <API_KEY>` (oder
`Authorization: Bearer <API_KEY>`):

```json
{ "total": 10, "backed_up": 7, "excluded": 1, "pending": 2, "orphaned": 1 }
```

`orphaned` = Crontab-Einträge ohne passenden Stack. Kann die Crontab oder
das Stacks-Verzeichnis nicht gelesen werden, antwortet die API mit `503`
statt falscher Zahlen. Ohne gesetztes `API_KEY` ist die API deaktiviert
(`503`).

`services.yaml` (Homepage muss im selben Docker-Netz `proxy` sein):

```yaml
- Backups:
    icon: mdi-backup-restore
    href: https://backups.example.com
    widget:
      type: customapi
      url: http://local-backup-tracker:3000/api/status
      headers:
        X-API-Key: "{{HOMEPAGE_VAR_BACKUP_TRACKER_KEY}}"
      mappings:
        - field: total
          label: Stacks
        - field: backed_up
          label: Gesichert
        - field: pending
          label: Offen
        - field: excluded
          label: Ausgenommen
```

## Sicherheitsmodell (Kurzfassung)

Wie beim mTLS Certificate Manager, ohne die Verschlüsselungsseite:

- Setup-Wizard beim ersten Aufruf (kein `data/admin.yml`): ein Admin-Konto,
  Passwort mind. 12 Zeichen, Argon2id-Hash.
- Permanente Kontosperre nach 3 Fehlversuchen, zusätzlich Rate-Limit auf
  `/login` (10 Versuche / 15 min pro IP).
- CSRF-Schutz (Synchronizer-Token) auf allen Formularen, `httpOnly` +
  `sameSite=strict` Session-Cookie, `secure` automatisch bei HTTPS.
- Stacks-Verzeichnis und Crontab sind read-only gemountet — die App kann
  dort nichts verändern.
- `/api/status` liefert nur Zahlen, keine Stack-Namen oder Pfade.

## Admin-Konto entsperren

```bash
docker exec -it local-backup-tracker node cli.js unlock-admin
```

## Umgebungsvariablen

| Variable | Default | Beschreibung |
|---|---|---|
| `PORT` | `3000` | Port der Web-UI |
| `PUID` / `PGID` | `1000` / `1000` | User/Group-ID des Node-Prozesses (Dateirechte auf `data/`) |
| `STACKS_DIR` | `/stacks` | Stacks-Verzeichnis im Container |
| `HOST_STACKS_DIR` | — | Dasselbe Verzeichnis auf dem Host, so wie es in der Crontab steht. Wird in `docker-compose.yml` auch als Mount-Quelle verwendet |
| `CRONTAB_PATH` | `/config/cron.d` | Crontab-Datei oder -Verzeichnis im Container |
| `CRON_DIR` | `/etc/cron.d` | Nur `docker-compose.yml`: Host-Verzeichnis, das nach `/config/cron.d` gemountet wird |
| `BACKUP_SCRIPT_NAME` | `docker-stack-backup.sh` | Dateiname des Backup-Scripts in den Cron-Zeilen |
| `API_KEY` | — | Schlüssel für `/api/status` (z. B. `openssl rand -hex 32`) |
| `SESSION_SECRET` | *(auto-generiert)* | Optional; sonst einmalig erzeugt und in `data/config.yml` gespeichert |

## Docker

```bash
cp .env.example .env   # HOST_STACKS_DIR, API_KEY, PUID/PGID eintragen
docker compose up -d --build
```

## Volumes

| Pfad im Container | Inhalt |
|---|---|
| `/app/data` | `admin.yml`, `excluded.yml`, `config.yml` |
| `/stacks` (ro) | Stacks-Verzeichnis |
| `/config/cron.d` (ro) | Crontab-Verzeichnis |

## Backup

Nur `data/` — und damit sollte dieser Stack selbst natürlich auch in der
Crontab stehen.

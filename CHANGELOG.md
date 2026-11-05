# Changelog

## 0.6

### Gewijzigd
- Neon: alleen de lijnen en vormen gloeien nog; de tekst blijft standaard scherp.

### Nieuw
- Optie `text_glow` (in de editor: **Gloeiende tekst**) om in de neonstijl ook de tekst te laten gloeien.

## 0.5

### Nieuw
- Optie `style` met drie stijlen: `light`, `dark` en `neon`. Zonder `style` (of met `auto`) volgt de card zoals voorheen het thema.
- Neonstijl: doorzichtige achtergrond, toestellen als gloeiende lijntekening (koper voor haard en radiatoren, cyaan voor de CV-ketel), dunne gloeiende leidingen en een buffervat van oranje naar turquoise.
- Elke stijl heeft eigen standaardkleuren voor koud en warm; `cold_color` en `hot_color` overschrijven die nog altijd.
- Nieuwe kleuropties `accent_warm`, `accent_cold`, `pump_color` en `background`, in de editor onder **Kleuren** met een kleurkiezer. Card-mod is daarvoor niet meer nodig.
- Alle kleuren mogen als hex-code, als `[r, g, b]` of als CSS-kleur opgegeven worden.
- Dezelfde kleuren kunnen ook via het thema gezet worden met CSS-variabelen (`--heating-card-background`, `--heating-card-accent-warm`, ...).

### Verbeterd
- Het `ha-card`-element wordt maar één keer opgebouwd en daarna alleen bijgewerkt. Daardoor blijven stijlen van card-mod behouden bij elke statuswijziging.

## 0.4

### Gewijzigd
- Pompschoepen zijn groter en draaien trager.
- De buitentemperatuur is een algemene optie (`outdoor`) en staat niet meer onder de CV-ketel. Een oude `boiler.outdoor` wordt nog gelezen.
- De CV-ketel heeft geen temperatuur meer; het display toont AAN/UIT.

### Nieuw
- `boiler.gas`: het gasverbruik van vandaag (m³) wordt op de CV-ketel getoond.

## 0.3

Eerste publieke versie van de Heating Card.

### Functies
- Schema van de verwarmingsinstallatie met buffervat, radiatoren, houthaard en CV-ketel (gaswandketel).
- Kleurverloop in het buffervat, live berekend uit de buffersensoren (instelbaar met `min_temp`, `max_temp`, `cold_color` en `hot_color`).
- Aanvoer- en retourleidingen kleuren mee met de boven- en onderkant van de buffer.
- Bewegende stroming in de leidingen zolang een pomp draait of de ketel brandt.
- Pompsymbolen met een draaiende schoep (in de stroomrichting) en een pulserende ring.
- Flikkerende vlammen in de haard en een blauwe gasvlam in de CV-ketel.
- Buitentemperatuur boven de ketel, en een optionele temperatuur op het ketel-display.
- Tik op een temperatuur, pomp of toestel om het detailvenster te openen.
- Visuele editor in het dashboard; configuratie via YAML kan ook.
- Volgt het lichte of donkere thema; kleuren aanpasbaar met CSS-variabelen.
- Respecteert de systeeminstelling "minder beweging".

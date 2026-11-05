# Changelog

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

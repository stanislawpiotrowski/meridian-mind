# Starter-Set Data Provenance

Auditable record of the source and derivation method behind every non-trivial
coordinate in the three curated starter sets. The authoritative "zero invalid
rows" proof happens at the add step (a successful POST creating a set with the
exact expected card count); this document supports the human coordinate
spot-check and any future correction.

All three CSVs are UTF-8 encoded with the exact header `name,latitude,longitude`.

---

## Crown of the Earth — 9 peaks

Combined Bass + Messner seven-summits lists (9 distinct peaks because the two
lists disagree on the Australia/Oceania summit: Kosciuszko for Bass, Puncak Jaya
for Messner). Each `name` carries elevation in the strict format
`Name (elevation m)` — no continent labels. The point is the **summit**, not a
base camp or trailhead.

| Peak             | Elevation basis                                                              | Summit coordinate basis                |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| Mount Everest    | 8848 m (long-standing/Survey-of-India figure; the value the brief specified) | Summit point on the Nepal–China border |
| Aconcagua        | 6961 m (commonly cited height)                                               | Main summit, Mendoza, Argentina        |
| Denali           | 6190 m (2015 USGS resurvey)                                                  | South summit, Alaska Range             |
| Kilimanjaro      | 5895 m (Uhuru Peak)                                                          | Uhuru Peak, Kibo cone                  |
| Vinson Massif    | 4892 m (Mount Vinson, Antarctica)                                            | Summit of Mount Vinson, Sentinel Range |
| Elbrus           | 5642 m (west summit; Europe per Messner/Bass)                                | West summit, Caucasus                  |
| Mont Blanc       | 4810 m (rounded summit height)                                               | Summit on the France–Italy frontier    |
| Puncak Jaya      | 4884 m (Carstensz Pyramid; Oceania per Messner)                              | Summit, Sudirman Range, Papua          |
| Mount Kosciuszko | 2230 m (Australia per Bass)                                                  | Summit, Snowy Mountains, NSW           |

Elevation figures match the values fixed in the change brief. Coordinates are
each summit's lat/lng to ≥4 decimal places.

---

## European capitals — 48

Bare capital names (no country suffix); each point is the recognized **city
center** (the conventional central reference point used by mapping services),
to ≥4 decimal places.

**Membership basis (why these 48):** capitals of the European sovereign states
on a Council-of-Europe-style basis. This includes the South Caucasus members
Armenia (Yerevan) and Georgia (Tbilisi) and the European microstates
(Andorra la Vella, Monaco, San Marino, Vaduz, Vatican City). It excludes states
whose territory is predominantly outside geographic Europe under this framing
(Azerbaijan, Kazakhstan, Turkey). This yields exactly 48 entries. The set is a
defensible, internally consistent "Europe" — not the only possible list; the
manual map spot-check covers a sampled capital.

Diacritics preserved (UTF-8): `Reykjavík`, `Chișinău`.

---

## National Parks of Poland — 23

All 23 Polish national parks (`parki narodowe`), bare names with Polish
diacritics. The point is each park's **geographic centroid** — explicitly NOT
the park HQ / visitor office / nearest town, which is the highest-risk
confusion for this set.

**Centroid method:** each coordinate is the approximate geographic center of the
park's official boundary, derived from the park's published boundary extent
(bounding box midpoint, sanity-checked against the park's mapped shape). Values
are given to 4 decimal places. For parks with irregular or near-non-contiguous
shapes the centroid is placed inside the largest contiguous core area so the pin
still lands on protected land rather than in a gap.

| #   | Park            | Notes on centroid placement                                        |
| --- | --------------- | ------------------------------------------------------------------ |
| 1   | Babiogórski     | Centered on the Babia Góra massif (S Poland, by the Slovak border) |
| 2   | Białowieski     | Center of the Białowieża Forest core, near the Belarus border      |
| 3   | Biebrzański     | Largest Polish park; centroid in the central Biebrza marshes       |
| 4   | Bieszczadzki    | SE corner, Bieszczady mountains                                    |
| 5   | Bory Tucholskie | Center of the lake-and-pine-forest area, N Poland                  |
| 6   | Drawieński      | NW Poland, Drawa river forest                                      |
| 7   | Gorczański      | Gorce range, S Poland                                              |
| 8   | Gór Stołowych   | Stołowe (Table) Mountains, SW border with Czechia                  |
| 9   | Kampinoski      | Forest west of Warsaw                                              |
| 10  | Karkonoski      | Karkonosze (Giant Mts) ridge, SW border                            |
| 11  | Magurski        | Low Beskids, SE Poland                                             |
| 12  | Narwiański      | Narew braided-river marshes, NE Poland                             |
| 13  | Ojcowski        | Smallest park; Prądnik valley near Kraków                          |
| 14  | Pieniński       | Pieniny gorge of the Dunajec, S border                             |
| 15  | Poleski         | Wetlands of Polesie, E Poland                                      |
| 16  | Roztoczański    | Roztocze hills, SE Poland                                          |
| 17  | Słowiński       | Baltic coast dunes & lakes, N Poland                               |
| 18  | Świętokrzyski   | Łysogóry range, central Poland                                     |
| 19  | Tatrzański      | Polish High & Western Tatras, S border                             |
| 20  | Ujście Warty    | Warta–Odra confluence wetlands, W border                           |
| 21  | Wielkopolski    | Lakeland S of Poznań                                               |
| 22  | Wigierski       | Lake Wigry area, NE Poland                                         |
| 23  | Woliński        | Wolin island, Baltic NW coast                                      |

Judgment calls: Słowiński and Woliński are coastal — their centroids sit on land
within the park rather than offshore. Ujście Warty and the river-valley parks
(Narwiański, Biebrzański) are elongated; the centroid is placed in the central
core of the protected area.

Diacritics preserved (UTF-8): `Babiogórski`, `Białowieski`, `Gór Stołowych`,
`Słowiński`, `Świętokrzyski`.

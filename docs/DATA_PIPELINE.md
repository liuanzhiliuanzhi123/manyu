# Data Pipeline

## Scope

The current data pipeline supports Beijing MVP only. It does not attempt nationwide city coverage.

## Sources

- High-confidence Beijing seed data from the project.
- 高德 Web 服务 API for POI expansion.
- 高德 POI photos when available.
- Placeholder images for missing images.

## Categories

The generated cache uses three strict root categories:

- `scenic`: 景区 and main activity POIs.
- `food`: restaurants and food stops.
- `hotel`: hotels and lodging options.

Food and hotel items are not counted as main scenic activities in the planner.

## Current Cache

`data/beijing-pois.generated.json` currently contains:

- Total: 215 POIs
- Scenic: 101
- Food: 48
- Hotel: 66
- With image: 214
- Placeholder: 1

## Import Process

1. Query high-value Beijing POI keywords from 高德.
2. Normalize coordinates, city, district, address, rating, price and photos.
3. Classify into scenic, food, or hotel.
4. Add subTags for finer filtering.
5. Remove non-Beijing entries.
6. Remove formal non-destination entries such as ticket windows or service counters.
7. Deduplicate by POI identity and name.
8. Isolate low-confidence or uncertain POIs.
9. Attach images or root-category placeholders.
10. Write generated cache only after dry-run checks pass.

## SubTag System

Scenic examples:

- nature
- culture
- popular
- museum
- temple
- familyFriendly
- nightView

Food examples:

- localSpecialty
- halal
- beijingCuisine
- pekingDuck
- snack
- lateNightFood

Hotel examples:

- fiveStar
- comfortHotel
- budgetHotel
- familyHotel
- nearMetro
- businessAreaHotel

## Classification Guardrails

- Scenic list must not contain restaurants or hotels.
- Food list must not contain scenic spots or hotels.
- Hotel list must not contain scenic spots or restaurants.
- Search and filters use root category first, then subTags.
- The planner maps `scenic` to main activities, `food` to meals, and `hotel` to lodging.

## Image Fallback

The image pipeline prefers exact POI images. When unavailable, it falls back to root-category placeholders:

- scenic placeholder
- food placeholder
- hotel placeholder

The placeholder path is committed, but no API key or fetch token is stored in data.

## Commands

Dry-run and import scripts are kept in `scripts/`. Routine verification:

```bash
corepack pnpm run verify:beijing-quality
corepack pnpm run test
```

# AquaWatch data sources and limits

## City weather and forecasts

- **Provider:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs) and [Geocoding API](https://open-meteo.com/en/docs/geocoding-api).
- **What it supplies:** current temperature, feels-like temperature, humidity, wind, weather conditions, daily high/low, rain totals, rain chance, and hourly/daily outlooks.
- **Where:** weather markers cover more than 100 curated city locations across many countries. Search uses Open-Meteo's worldwide city lookup, so users can select other cities too. The city list is a set of reference points, not a marker in every country or an administrative boundary dataset.
- **Area averages:** local dashboard values average the selected city and up to four nearby cities or clearly labelled nearby forecast points. Jakarta uses its named local districts.
- **Refresh:** city markers refresh every 30 minutes; selected-area weather refreshes every 15 minutes; the forecast page refreshes every 30 minutes. The browser keeps recent results between refreshes.
- **Meaning:** these are weather-model estimates, not readings from a local rain gauge. Daily rain totals and forecasts can change as the provider updates its models.

## River flow

- **Provider:** [Open-Meteo Global Flood API](https://open-meteo.com/en/docs/flood-api), using the Global Flood Awareness System (GloFAS).
- **What it supplies:** simulated daily river-flow estimates (m³/s) at nearby river locations. m³/s is the volume of water moving past each second. The seven-day page shows an average of available nearby values.
- **Limit:** the nearest mapped river can be the wrong river for a location, and some places have no river value. Flow is how quickly water moves through a river; it is **not** measured water height, flood depth, or a gauge reading.

## Flood-risk estimate

The page shows a simple **Low / Watch / High** guide based on average forecast rain: High at 50 mm or more, or at least 25 mm with a rain chance of 70% or higher; Watch at 20 mm or more, or at least 10 mm with a rain chance of 70% or higher. These broad rules are for an easy-to-read planning cue, not a locally calibrated flood probability or official warning. Drainage, terrain, river levels, and local conditions also matter. Follow local emergency services for current warnings.

## Reported floods and storms

- **Provider:** [NASA EONET](https://eonet.gsfc.nasa.gov/docs/v3).
- **What it supplies:** reported global flood and severe-storm event markers. The dashboard filters nearby alerts around the selected city; these reports are distinct from the weather forecast.

## Optional AI backend

The FastAPI/PyTorch `POST /api/forecast` service remains as a development prototype and is not used for the user-facing seven-day forecast. Its pretrained ResNet18 image encoder has an untrained precipitation/anomaly output head unless a task-specific checkpoint is supplied. Without one, its output is illustrative only—not a real or calibrated weather forecast.

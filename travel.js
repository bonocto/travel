// travel.js — quick travel-time estimates from the distance between two pins
// (Your own number from Google Maps always wins. These are just handy helpers.)

// 1. Straight-line distance between two pins, in km (the "haversine" formula)
function distanceKm(from, to) {
  const earth = 6371; // the Earth's radius in km
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

// 2. Rules of thumb: speed in km/h, plus extra minutes (waiting, walking to the station…)
const travelModes = [
  { icon: "🚶", speed: 4.5, extra: 0, maxKm: 4 },  // only offered up to 4 km
  { icon: "🚇", speed: 25, extra: 10, minKm: 1 },  // only offered from 1 km
  { icon: "🚕", speed: 22, extra: 5 },
];

// 3. Estimates from one stop to the next: { km: 2.4, list: [{ icon: "🚶", minutes: 35 }, …] }
function travelEstimates(from, to) {
  if (!from.lat || !to.lat) {
    return null; // both stops need a pin on the map
  }
  const km = distanceKm(from, to) * 1.3; // streets aren't straight lines
  const estimates = [];
  for (const mode of travelModes) {
    if ((mode.maxKm && km > mode.maxKm) || (mode.minKm && km < mode.minKm)) {
      continue; // skip modes that don't make sense for this distance
    }
    const minutes = (km / mode.speed) * 60 + mode.extra;
    estimates.push({ icon: mode.icon, minutes: Math.max(5, Math.ceil(minutes / 5) * 5) });
  }
  return { km: km, list: estimates };
}

// 4. The little estimate buttons under the gap between stop i and the next one
function estimateButtons(i, from, to) {
  const estimates = travelEstimates(from, to);
  if (estimates === null) {
    return "";
  }
  let html = `<div class="estimates">≈ ${estimates.km.toFixed(1)} km:`;
  for (const estimate of estimates.list) {
    const chosen = from.travelIcon === estimate.icon && from.travel === estimate.minutes;
    html += `<button class="estimate-button ${chosen ? "chosen" : ""}" onclick="setTravel(${i}, ${estimate.minutes}, '${estimate.icon}')">${estimate.icon} ${estimate.minutes} min</button>`;
  }
  return html + `</div>`;
}

// 5. Tap an estimate: use it as the travel time (you can still edit it any time)
function setTravel(i, minutes, icon) {
  const stop = currentDay.stops[i];
  remember(`Travel after ${stop.name}: ${icon} ${minutes} min`);
  stop.travel = minutes;
  stop.travelIcon = icon;
  saveTrip();
  hideSuggestions();
  showStops();
  showSuggestions(stop, planChanges(stop)); // the rest of the day may need to move
}
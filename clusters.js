// clusters.js — "Nearby groups": saved places that are a short walk from each other
// It spots them and offers to plan them together. Nothing is added unless you tap.

let clusters = []; // the groups currently shown

// 1. Walking minutes between two pins (same rule of thumb as travel.js)
function walkMinutes(a, b) {
  return (distanceKm(a, b) * 1.3 / 4.5) * 60;
}

// 2. Find groups: start with one place, keep adding any place within a 10-min walk
//    of ANY place already in the group
function findClusters() {
  const pinned = getPlaces().filter((place) => place.lat && !place.visited);
  const used = [];
  const groups = [];
  for (const place of pinned) {
    if (used.includes(place)) {
      continue;
    }
    const group = [place];
    used.push(place);
    for (let k = 0; k < group.length; k++) { // the group grows while we loop
      for (const other of pinned) {
        if (!used.includes(other) && walkMinutes(group[k], other) <= 10) {
          group.push(other);
          used.push(other);
        }
      }
    }
    if (group.length >= 2) {
      groups.push(walkingOrder(group));
    }
  }
  return groups;
}

// 3. A sensible walking order: from each place, go to the nearest one not visited yet
function walkingOrder(group) {
  const left = group.slice(1);
  const route = [group[0]];
  while (left.length > 0) {
    const here = route[route.length - 1];
    left.sort((a, b) => walkMinutes(here, a) - walkMinutes(here, b));
    route.push(left.shift());
  }
  return route;
}

// 4. Which day already has a stop near this group? (so it's easy to slot in)
function nearestDay(route) {
  let best = null;
  trip.days.forEach(function (day, dayIndex) {
    for (const stop of day.stops) {
      if (!stop.lat || stop.hotel) {
        continue;
      }
      const walk = Math.min(...route.map((place) => walkMinutes(stop, place)));
      if (walk <= 20 && (best === null || walk < best.walk)) {
        best = { dayIndex: dayIndex, stop: stop, walk: walk };
      }
    }
  });
  return best;
}

// 5. The "Nearby groups" cards at the top of the Places screen
function clustersHtml() {
  clusters = findClusters();
  if (clusters.length === 0) {
    return "";
  }
  let html = `<h3>🗺️ Nearby groups</h3>`;
  clusters.forEach(function (route, c) {
    let walking = 0;
    let visiting = 0;
    route.forEach(function (place, k) {
      visiting += place.duration;
      if (k > 0) {
        walking += Math.ceil(walkMinutes(route[k - 1], place) / 5) * 5;
      }
    });
    const near = nearestDay(route);

    let dayOptions = "";
    trip.days.forEach(function (day, d) {
      const selected = near && near.dayIndex === d ? "selected" : "";
      dayOptions += `<option value="${d}" ${selected}>Day ${day.number} — ${day.label}</option>`;
    });
    let start = "";
    if (near) {
      start = toTime(Math.ceil((toMinutes(near.stop.time) + near.stop.duration + near.walk) / 5) * 5);
    }

    html += `<div class="item cluster">`;
    html += `<b>${route.length} places within a short walk</b><br>`;
    html += `<span class="small">${route.map((place) => place.name).join(" → ")}</span><br>`;
    html += `<span class="small">⏱️ About ${niceLength(visiting + walking)} together (${niceLength(walking)} of walking)</span>`;
    if (near) {
      html += `<br><span class="small">📍 Near ${near.stop.name} on Day ${trip.days[near.dayIndex].number}</span>`;
    }
    html += `<details><summary class="small-summary">📅 Plan them together</summary>`;
    html += `<label>Day <select id="cluster-day-${c}">${dayOptions}</select></label>`;
    html += `<label>Start time <input id="cluster-time-${c}" type="time" value="${start}"></label>`;
    html += `<button onclick="planCluster(${c})">Add all ${route.length} to this day</button>`;
    html += `</details>`;
    html += `</div>`;
  });
  return html;
}

// 6. "Add all to this day": add them in walking order, one after the other
function planCluster(c) {
  const route = clusters[c];
  const dayIndex = Number(document.getElementById(`cluster-day-${c}`).value);
  const time = document.getElementById(`cluster-time-${c}`).value;
  if (!time) {
    alert("Please choose a start time.");
    return;
  }

  currentDay = trip.days[dayIndex];
  remember(`Added ${route.length} nearby places`);

  let clock = toMinutes(time);
  let first = null;
  route.forEach(function (place, k) {
    const next = route[k + 1];
    const walk = next ? Math.max(5, Math.ceil(walkMinutes(place, next) / 5) * 5) : 15;
    const stop = Object.assign(placeFromStop(place), {
      type: "flexible",
      time: toTime(clock),
      travel: walk,
    });
    if (next) {
      stop.travelIcon = "🚶";
    }
    currentDay.stops.push(stop);
    getPlaces().splice(getPlaces().indexOf(place), 1);
    first = first || stop;
    clock += place.duration + walk;
  });

  saveTrip();
  openDay(dayIndex);
  showSuggestions(first, planChanges(first)); // in case it bumps into later stops
}
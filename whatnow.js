// whatnow.js — "🧭 What now?" and "While you're here"
// Suggests saved places that fit your free time. It never adds anything without asking.

let whatNowOptions = []; // the suggestions currently on screen

// 1. The quickest sensible way to get from a to b: walk if it's 15 min or less,
//    otherwise MRT (unless a taxi is much faster)
function quickestTravel(a, b) {
  const estimates = travelEstimates(a, b);
  if (estimates === null) {
    return null;
  }
  const walk = estimates.list.find((e) => e.icon === "🚶");
  const mrt = estimates.list.find((e) => e.icon === "🚇");
  const taxi = estimates.list.find((e) => e.icon === "🚕");
  if (walk && walk.minutes <= 15) {
    return walk;
  }
  if (mrt && mrt.minutes <= taxi.minutes + 10) {
    return mrt;
  }
  return taxi;
}

// 2. Where are you? Your last stop that has a map pin (or your phone's location)
function lastPinnedStop() {
  let best = null;
  for (const stop of currentDay.stops) {
    if (stop.lat && toMinutes(stop.time) <= nowMinutes()) {
      best = stop;
    }
  }
  return best || currentDay.stops.find((stop) => stop.lat) || null;
}

function getMyLocation() {
  return new Promise(function (resolve) {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ name: "where you are", lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null), // you said no, or it couldn't find you
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

// 3. Would this place fit? Works out travel there, time there, and travel back
function planVisit(place, from, now, next, until) {
  if (!place.lat) {
    return null;
  }
  const there = quickestTravel(from, place);
  const back = next && next.lat ? quickestTravel(place, next) : null;
  let arrive = Math.ceil((now + there.minutes) / 5) * 5;
  if (place.opens) {
    arrive = Math.max(arrive, toMinutes(place.opens)); // not before it opens
  }
  let latest = until - (back ? back.minutes : 0); // when you must leave to be on time
  if (place.closes) {
    latest = Math.min(latest, toMinutes(place.closes));
  }
  const room = latest - arrive;
  const buys = getWishlist().filter((item) => !item.bought && soldAt(item, place.name)).length;

  let fit = "no";
  let stay = place.duration;
  if (room >= place.duration) {
    fit = "yes";
  } else if (room >= Math.max(15, place.duration / 2)) {
    fit = "short";
    stay = Math.floor(room / 5) * 5;
  }
  return { place: place, there: there, back: back, arrive: arrive, stay: stay, fit: fit, buys: buys };
}

// 4. "🧭 What now?"
async function whatNow(useMyLocation) {
  const now = nowMinutes();
  const { next } = findNowNext();
  const until = next ? toMinutes(next.time) : 22 * 60;

  let from = null;
  if (useMyLocation) {
    suggestionsBox.innerHTML = "<p>📍 Finding where you are…</p>";
    suggestionsBox.hidden = false;
    from = await getMyLocation();
  }
  const usedLocation = from !== null;
  if (!from) {
    from = lastPinnedStop();
  }

  let html = `<h3>🧭 What now?</h3>`;
  html += `<p>It's ${toTime(now)}. You have <b>${niceLength(Math.max(0, until - now))}</b> free`;
  html += next ? ` before ${next.name} (${next.time}).` : ` this evening.`;
  if (from) {
    html += ` Starting from ${usedLocation ? "where you are now" : from.name}.`;
  }
  html += `</p>`;
  if (useMyLocation && !usedLocation) {
    html += `<p class="small">Couldn't get your location, so I used your last stop instead.</p>`;
  }

  // Look at every saved place
  whatNowOptions = [];
  let noPin = 0;
  const tooLong = [];
  if (from) {
    for (const place of getPlaces().filter((place) => !place.visited)) {
      const visit = planVisit(place, from, now, next, until);
      if (visit === null) {
        noPin++;
      } else if (visit.fit === "no") {
        tooLong.push(place.name);
      } else {
        whatNowOptions.push(visit);
      }
    }
  }

  // Best first: full visits, then things to buy, then the closest
  whatNowOptions.sort(function (a, b) {
    if (a.fit !== b.fit) {
      return a.fit === "yes" ? -1 : 1;
    }
    if (a.buys !== b.buys) {
      return b.buys - a.buys;
    }
    return a.there.minutes - b.there.minutes;
  });
  whatNowOptions = whatNowOptions.slice(0, 3); // just the top 3, so it's not overwhelming

  if (!from) {
    html += `<p>Give your stops a 📍 map pin and I can work out what's nearby.</p>`;
  } else if (whatNowOptions.length === 0) {
    html += `<p>Nothing from ⭐ Places fits right now. Maybe a coffee break? ☕</p>`;
  }
  for (let i = 0; i < whatNowOptions.length; i++) {
    const visit = whatNowOptions[i];
    html += `<div class="what-now-option">`;
    html += `<b>${visit.place.name}</b><br>`;
    html += `<span class="small">${visit.there.icon} ${visit.there.minutes} min there · `;
    html += visit.fit === "yes" ? `stay ${niceLength(visit.stay)}` : `short visit: ${niceLength(visit.stay)} (not the full ${niceLength(visit.place.duration)})`;
    if (next) {
      html += ` · back in time for ${next.name} ✅`;
    }
    html += `</span>`;
    if (visit.buys > 0) {
      html += `<br><span class="small">🛍️ ${visit.buys} thing${visit.buys === 1 ? "" : "s"} on your Don't Forget list here</span>`;
    }
    if (visit.place.opens) {
      html += `<br><span class="small">🕙 Opens at ${visit.place.opens}</span>`;
    }
    if (visit.place.closes) {
      html += `<br><span class="small">🕔 Closes at ${visit.place.closes}</span>`;
    }
    html += `<br><button onclick="addFromWhatNow(${i})">Add at ${toTime(visit.arrive)}</button>`;
    html += `</div>`;
  }

  if (tooLong.length > 0) {
    html += `<p class="small">Won't fit this time: ${tooLong.join(", ")}</p>`;
  }
  if (noPin > 0) {
    html += `<p class="small">${noPin} saved place${noPin === 1 ? " isn't" : "s aren't"} on the map, so I couldn't check ${noPin === 1 ? "it" : "them"}.</p>`;
  }
  html += `<button onclick="whatNow(true)">📍 Use where I am right now</button> `;
  html += `<button onclick="hideSuggestions()">Close</button>`;

  suggestionsBox.innerHTML = html;
  suggestionsBox.hidden = false;
  suggestionsBox.scrollIntoView({ behavior: "smooth" });
}

// 5. "Add at 14:30": turn the place into a stop today
function addFromWhatNow(i) {
  const visit = whatNowOptions[i];
  const place = visit.place;
  remember(`Added ${place.name} (What now?)`);

  const stop = {
    name: place.name,
    type: "flexible",
    time: toTime(visit.arrive),
    duration: visit.stay,
    travel: visit.back ? visit.back.minutes : 15,
    address: place.address,
    notes: place.notes,
    closes: place.closes || "",
    lat: place.lat,
    lng: place.lng,
  };
  if (visit.back) {
    stop.travelIcon = visit.back.icon;
  }
  currentDay.stops.push(stop);
  getPlaces().splice(getPlaces().indexOf(place), 1);

  saveTrip();
  hideSuggestions();
  showStops();
  showSuggestions(stop, planChanges(stop)); // just in case it nudges anything later
}

// 6. "While you're here": saved places within a 10-minute walk of a stop
function nearbySaved(stop) {
  if (!stop.lat) {
    return "";
  }
  const close = [];
  for (const place of getPlaces().filter((place) => !place.visited)) {
    const estimates = place.lat ? travelEstimates(stop, place) : null;
    const walk = estimates ? estimates.list.find((e) => e.icon === "🚶") : null;
    if (walk && walk.minutes <= 10) {
      close.push(`${place.name} (🚶 ${walk.minutes} min)`);
    }
  }
  if (close.length === 0) {
    return "";
  }
  return `<div class="nearby">⭐ While you're here: ${close.join(" · ")}</div>`;
}
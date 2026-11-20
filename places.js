// Places I'd Love to Visit: saved places that aren't in a day yet

// 1. Find things on the page by their id
const placeForm = document.getElementById("place-form");
const placeList = document.getElementById("place-list");
const addPlaceDetails = document.getElementById("add-place");
const placeFormTitle = document.getElementById("place-form-title");
const placeSubmit = document.getElementById("place-submit");
const placeCancel = document.getElementById("place-cancel");
const placePinStatus = document.getElementById("place-pin-status");
let editingPlaceIndex = null; // null = saving a new place, a number = editing that place
let placeFormPin = null;      // a pin you chose for the place being saved/edited
let placeMap = null;          // the little map in the form
let placeMarker = null;

// 2. The places list lives inside the trip (created the first time it's needed)
function getPlaces() {
  if (!trip.places) {
    trip.places = [];
  }
  return trip.places;
}

// 3. Open the Places screen
function openPlaces() {
  resetPlaceForm();
  showPlaces();
  showScreen("places-view");
}

// 4. Look a place up on the map (by address, or "name, destination")
//    Gives back { lat, lng }, or null if it can't be found (or you're offline)
async function findPin(name, address) {
  const query = address || `${name}, ${trip.destination}`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    const results = await response.json();
    if (results.length > 0) {
      return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
    }
  } catch (error) {
    // offline, or the search didn't work
  }
  return null;
}

// 5. Show the saved places, each with an "Add to a day" option
function showPlaces() {
  const places = getPlaces();
  if (places.length === 0) {
    placeList.innerHTML = "<p>No saved places yet.</p>";
    return;
  }

  // The list of days, for the "Day" drop-downs
  let dayOptions = "";
  for (let d = 0; d < trip.days.length; d++) {
    const day = trip.days[d];
    dayOptions += `<option value="${d}">Day ${day.number} — ${day.label}</option>`;
  }

  let html = "";
  if (places.some((place) => !place.lat)) {
    html += `<button id="find-pins-button" onclick="findMissingPins()">📍 Find missing map pins</button>`;
  }
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    html += `<div class="item">`;
    html += `<div class="stop-name">${place.name}</div>`;
    if (place.address) {
      html += `<div class="small">📍 ${place.address}</div>`;
    }
    html += `<div class="small">⏱️ About ${place.duration} min</div>`;
    if (place.closes) {
      html += `<div class="small">🕔 Closes at ${place.closes}</div>`;
    }
    if (place.notes) {
      html += `<div class="small">📝 ${place.notes}</div>`;
    }
    if (!place.lat) {
      html += `<div class="small warning">Not on the map yet, so 🧭 What now? can't suggest it</div>`;
    }

    html += `<details><summary class="small-summary">📅 Add to a day</summary>`;
    html += `<label>Day <select id="place-day-${i}">${dayOptions}</select></label>`;
    html += `<label>Start time <input id="place-time-${i}" type="time"></label>`;
    html += `<label>Type <select id="place-type-${i}">`;
    html += `<option value="flexible">Flexible – can be moved</option>`;
    html += `<option value="bonus">Bonus – only if there's time</option>`;
    html += `</select></label>`;
    html += `<button onclick="schedulePlace(${i})">Add to this day</button>`;
    html += `</details>`;

    html += `<button class="edit-button" onclick="editPlace(${i})">Edit</button>`;
    html += `<button class="delete-button" onclick="deletePlace(${i})">Delete</button>`;
    html += `</div>`;
  }
  placeList.innerHTML = html;
}

// 6. Move a place into a day (it becomes a stop)
function schedulePlace(i) {
  const place = getPlaces()[i];
  const dayIndex = Number(document.getElementById(`place-day-${i}`).value);
  const time = document.getElementById(`place-time-${i}`).value;
  const type = document.getElementById(`place-type-${i}`).value;

  if (!time) {
    alert("Please choose a start time.");
    return;
  }

  const stop = {
    name: place.name,
    type: type,
    time: time,
    duration: place.duration,
    travel: 15,
    address: place.address,
    notes: place.notes,
    closes: place.closes || "",
    lat: place.lat || null,
    lng: place.lng || null,
    shops: place.shops,
    directory: place.directory,
  };

  currentDay = trip.days[dayIndex];
  remember(`Added ${place.name} from Places`);
  currentDay.stops.push(stop);
  getPlaces().splice(i, 1);
  saveTrip();

  // Go to that day, and check whether the new stop pushes anything later
  openDay(dayIndex);
  showSuggestions(stop, planChanges(stop));
}

// 7. Move a stop out of its day and back into Places
function unscheduleStop(i) {
  const stop = currentDay.stops[i];
  if (!confirm(`Move "${stop.name}" out of this day and into Places I'd Love to Visit?`)) {
    return;
  }
  hideSuggestions();
  resetStopForm();
  remember(`Moved ${stop.name} to Places`);
  currentDay.stops.splice(i, 1);
  getPlaces().push(placeFromStop(stop));
  saveTrip();
  showStops();
}

// 7b. Turn a stop back into a saved place (keeping its pin and closing time)
function placeFromStop(stop) {
  return {
    name: stop.name,
    address: stop.address,
    duration: stop.duration,
    notes: stop.notes,
    closes: stop.closes || "",
    lat: stop.lat || null,
    lng: stop.lng || null,
    shops: stop.shops,
    directory: stop.directory,
  };
}

// 8. Delete a place (always ask first)
function deletePlace(i) {
  const place = getPlaces()[i];
  if (!confirm(`Delete "${place.name}"?`)) {
    return;
  }
  resetPlaceForm(); // in case you were editing it
  getPlaces().splice(i, 1);
  saveTrip();
  showPlaces();
}

// 9. Edit a place: fill the form with its details
function editPlace(i) {
  const place = getPlaces()[i];
  editingPlaceIndex = i;
  placeFormPin = null;
  document.getElementById("place-name").value = place.name;
  document.getElementById("place-address").value = place.address;
  document.getElementById("place-duration").value = place.duration;
  document.getElementById("place-closes").value = place.closes || "";
  document.getElementById("place-notes").value = place.notes;

  placeFormTitle.textContent = `Edit: ${place.name}`;
  placeSubmit.textContent = "Save changes";
  placeCancel.hidden = false;
  addPlaceDetails.open = true;
  setTimeout(showPlaceMap, 50); // show its pin on the little map
  addPlaceDetails.scrollIntoView({ behavior: "smooth" });
}

// 9b. Put the form back to "Save a place"
function resetPlaceForm() {
  editingPlaceIndex = null;
  placeFormPin = null;
  placeForm.reset();
  placeFormTitle.textContent = "+ Save a place";
  placeSubmit.textContent = "Save place";
  placeCancel.hidden = true;
  placePinStatus.textContent = "Tap the map to place the pin yourself.";
  addPlaceDetails.open = false;
}

// 9c. The little map in the form: shows the pin, and lets you tap to place it
function showPlaceMap() {
  if (!placeMap) {
    placeMap = L.map("place-map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(placeMap);
    placeMap.on("click", function (event) {
      placeFormPin = { lat: event.latlng.lat, lng: event.latlng.lng };
      setPlaceMarker(placeFormPin);
      placePinStatus.textContent = "📍 Pin placed from the map. Tap Save to keep it.";
    });
  }
  placeMap.invalidateSize(); // the map was hidden, so it needs to measure itself again

  const editing = editingPlaceIndex !== null ? getPlaces()[editingPlaceIndex] : null;
  const pin = placeFormPin || (editing && editing.lat ? editing : null);
  setPlaceMarker(pin);
  if (pin) {
    placeMap.setView([pin.lat, pin.lng], 16);
    placePinStatus.textContent = "📍 On the map. Tap somewhere else to move the pin.";
  } else {
    placeMap.setView(tripCentre(), 13);
  }
}

function setPlaceMarker(pin) {
  if (placeMarker) {
    placeMarker.remove();
    placeMarker = null;
  }
  if (pin) {
    placeMarker = L.marker([pin.lat, pin.lng], { icon: makeIcon("⭐", "#6b7a3a") }).addTo(placeMap);
  }
}

// Somewhere sensible to start the map: your hotel, or any stop or place with a pin
function tripCentre() {
  if (trip.hotel && trip.hotel.lat) {
    return [trip.hotel.lat, trip.hotel.lng];
  }
  for (const day of trip.days) {
    const stop = day.stops.find((s) => s.lat);
    if (stop) {
      return [stop.lat, stop.lng];
    }
  }
  const place = getPlaces().find((p) => p.lat);
  return place ? [place.lat, place.lng] : [1.29, 103.85]; // Singapore, if nothing else
}

addPlaceDetails.addEventListener("toggle", function () {
  if (addPlaceDetails.open) {
    setTimeout(showPlaceMap, 50); // wait a moment for the box to open
  }
});

// 9d. "🔍 Find on map" in the form: look it up now, so you can check the pin before saving
async function previewPlacePin() {
  const name = document.getElementById("place-name").value;
  const address = document.getElementById("place-address").value;
  if (!name && !address) {
    alert("Type a name or an address first.");
    return;
  }
  placePinStatus.textContent = "🔍 Looking…";
  const pin = await findPin(name, address);
  if (pin) {
    placeFormPin = pin;
    setPlaceMarker(pin);
    placeMap.setView([pin.lat, pin.lng], 16);
    placePinStatus.textContent = "✅ Found it. Wrong spot? Tap the right place on the map.";
  } else {
    placePinStatus.textContent = "Couldn't find it. Try a fuller address, or tap the map.";
  }
}

// 9e. When the form is saved: add a new place, or update the one being edited
placeForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const details = {
    name: document.getElementById("place-name").value,
    address: document.getElementById("place-address").value,
    duration: Number(document.getElementById("place-duration").value),
    closes: document.getElementById("place-closes").value,
    notes: document.getElementById("place-notes").value,
  };

  let place;
  if (editingPlaceIndex === null) {
    place = details;
    getPlaces().push(place);
  } else {
    place = getPlaces()[editingPlaceIndex];
    const moved = place.name !== details.name || place.address !== details.address;
    Object.assign(place, details);
    if (moved) {
      place.lat = null; // new name or address: look it up again
      place.lng = null;
    }
  }
  if (placeFormPin) {
    place.lat = placeFormPin.lat; // a pin you chose always wins
    place.lng = placeFormPin.lng;
  }

  saveTrip();
  resetPlaceForm();
  showPlaces();

  if (!place.lat) {
    const pin = await findPin(place.name, place.address);
    if (pin) {
      Object.assign(place, pin);
      saveTrip();
      showPlaces();
    }
  }
});

// 10. "📍 Find missing map pins": look up every place that isn't on the map yet
async function findMissingPins() {
  const button = document.getElementById("find-pins-button");
  const missing = getPlaces().filter((place) => !place.lat);
  let found = 0;
  for (let n = 0; n < missing.length; n++) {
    button.textContent = `🔍 Looking… ${n + 1} of ${missing.length}`;
    const pin = await findPin(missing[n].name, missing[n].address);
    if (pin) {
      Object.assign(missing[n], pin);
      found++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1100)); // the map search allows 1 search per second
  }
  saveTrip();
  showPlaces();
  alert(`Found ${found} of ${missing.length}. For any still missing, try adding a fuller address.`);
}
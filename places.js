// Places I'd Love to Visit: saved places that aren't in a day yet

// 1. Find things on the page by their id
const placeForm = document.getElementById("place-form");
const placeList = document.getElementById("place-list");
const addPlaceDetails = document.getElementById("add-place");

// 2. The places list lives inside the trip (created the first time it's needed)
function getPlaces() {
  if (!trip.places) {
    trip.places = [];
  }
  return trip.places;
}

// 3. Open the Places screen
function openPlaces() {
  addPlaceDetails.open = false;
  showPlaces();
  showScreen("places-view");
}

// 4. Show the saved places, each with an "Add to a day" option
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
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    html += `<div class="item">`;
    html += `<div class="stop-name">${place.name}</div>`;
    if (place.address) {
      html += `<div class="small">📍 ${place.address}</div>`;
    }
    html += `<div class="small">⏱️ About ${place.duration} min</div>`;
    if (place.notes) {
      html += `<div class="small">📝 ${place.notes}</div>`;
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

    html += `<button class="delete-button" onclick="deletePlace(${i})">Delete</button>`;
    html += `</div>`;
  }
  placeList.innerHTML = html;
}

// 5. Move a place into a day (it becomes a stop)
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

// 6. Move a stop out of its day and back into Places
function unscheduleStop(i) {
  const stop = currentDay.stops[i];
  if (!confirm(`Move "${stop.name}" out of this day and into Places I'd Love to Visit?`)) {
    return;
  }
  hideSuggestions();
  resetStopForm();
  remember(`Moved ${stop.name} to Places`);
  currentDay.stops.splice(i, 1);
  getPlaces().push({
    name: stop.name,
    address: stop.address,
    duration: stop.duration,
    notes: stop.notes,
  });
  saveTrip();
  showStops();
}

// 7. Delete a place (always ask first)
function deletePlace(i) {
  const place = getPlaces()[i];
  if (!confirm(`Delete "${place.name}"?`)) {
    return;
  }
  getPlaces().splice(i, 1);
  saveTrip();
  showPlaces();
}

// 8. When "Save place" is pressed, save it
placeForm.addEventListener("submit", function (event) {
  event.preventDefault();

  getPlaces().push({
    name: document.getElementById("place-name").value,
    address: document.getElementById("place-address").value,
    duration: Number(document.getElementById("place-duration").value),
    notes: document.getElementById("place-notes").value,
  });

  saveTrip();
  placeForm.reset();
  addPlaceDetails.open = false;
  showPlaces();
});
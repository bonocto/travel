// 1. Find things on the page by their id
const form = document.getElementById("trip-form");
const newTripSection = document.getElementById("new-trip");
const tripSection = document.getElementById("trip-section");
const tripView = document.getElementById("trip-view");
const newTripButton = document.getElementById("new-trip-button");
const dayView = document.getElementById("day-view");
const dayTitle = document.getElementById("day-title");
const stopList = document.getElementById("stop-list");
const backButton = document.getElementById("back-button");
const addStopDetails = document.getElementById("add-stop");
const stopForm = document.getElementById("stop-form");
const stopFormTitle = document.getElementById("stop-form-title");
const stopSubmit = document.getElementById("stop-submit");
const cancelEditButton = document.getElementById("cancel-edit");
const suggestionsBox = document.getElementById("suggestions");
const historyArea = document.getElementById("history-area");

// 2. The app's data
let trip = null;          // the current trip (null = no trip yet)
let currentDay = null;    // the day that's open on the day screen
let editingIndex = null;  // the stop being edited (null = adding a new one)
let pendingMoves = [];    // suggested time changes waiting for your answer

// 3. Show one screen and hide the others
function showScreen(id) {
  // Every <section> is a screen: show the one we want, hide the rest
  for (const section of document.querySelectorAll("section")) {
    section.hidden = section.id !== id;
  }
  updateMenu(id);
  window.scrollTo(0, 0);
}

// 4. Save the trip on this device
function saveTrip() {
  localStorage.setItem("trip", JSON.stringify(trip));
}

// 5. When "Create trip" is pressed, run this
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading

  const newTrip = {
    name: document.getElementById("trip-name").value,
    destination: document.getElementById("trip-destination").value,
    start: document.getElementById("trip-start").value,
    end: document.getElementById("trip-end").value,
  };

  if (newTrip.end < newTrip.start) {
    alert("Departure date can't be before arrival date.");
    return;
  }

  if (trip && !confirm("This will replace your current trip. Continue?")) {
    showTrip(); // changed your mind: go back to your current trip
    return;
  }

  newTrip.days = makeDays(newTrip.start, newTrip.end);
  trip = newTrip;
  saveTrip();
  showTrip();
});

// 6. Make one day for each date from arrival to departure
function makeDays(start, end) {
  const days = [];
  const date = new Date(start + "T12:00"); // midday avoids time-zone surprises
  const last = new Date(end + "T12:00");

  while (date <= last) {
    days.push({
      number: days.length + 1,
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
      focus: "",
      stops: [],
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// 7. Show the trip, with a button for each day
function showTrip() {
  let html = `<h2>${trip.name}</h2>`;
  html += `<p>${trip.destination}</p>`;
  html += countdownHtml();
  for (let i = 0; i < trip.days.length; i++) {
    const day = trip.days[i];
    html += dayButton(day, i);
  }
  tripView.innerHTML = html;
  showBackupStatus();
  showScreen("trip-section");
}

// 7c. One day on the trip screen: its theme, how many stops, and from when to when
function dayButton(day, i) {
  const isToday = day.date === todayDate();
  const visits = day.stops.filter((stop) => !stop.hotel).length;

  let summary = "Nothing planned yet";
  if (day.stops.length > 0) {
    const times = day.stops.map((stop) => toMinutes(stop.time));
    const ends = day.stops.map((stop) => toMinutes(stop.time) + stop.duration);
    summary = `${visits} stop${visits === 1 ? "" : "s"} · ${toTime(Math.min(...times))}–${toTime(Math.max(...ends))}`;
  }

  let html = `<button class="day-button ${isToday ? "today" : ""}" onclick="openDay(${i})">`;
  html += `<span class="day-number">Day ${day.number}</span> ${day.label}`;
  if (isToday) {
    html += `<span class="today-badge">Today</span>`;
  }
  if (day.focus) {
    html += `<span class="day-focus">${day.focus}</span>`;
  }
  html += `<span class="day-summary">${summary}</span>`;
  html += `</button>`;
  return html;
}

// 7b. "Last backup: 3 days ago" on the trip screen (orange when it's time for a new one)
function showBackupStatus() {
  const status = document.getElementById("backup-status");
  if (!trip.lastBackup) {
    status.textContent = "💾 No backup yet. Export a copy to your Mac, just in case.";
    status.className = "small backup-due";
    return;
  }
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((Date.now() - new Date(trip.lastBackup)) / oneDay);
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  if (days >= 3) {
    status.textContent = `💾 Last backup: ${when}. Time for a fresh one?`;
    status.className = "small backup-due";
  } else {
    status.textContent = `💾 Last backup: ${when}`;
    status.className = "small";
  }
}

// 8. Open one day on its own screen
function openDay(i) {
  currentDay = trip.days[i];
  dayTitle.textContent = `Day ${currentDay.number} — ${currentDay.label}`;
  document.getElementById("day-focus").value = currentDay.focus || "";
  hideSuggestions();
  resetStopForm();
  showScreen("day-view"); // show the screen first, so the map knows its size
  showStops();
}

// 9. Time helpers: "10:30" <-> 630 (minutes since midnight)
function toMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function toTime(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return String(hours).padStart(2, "0") + ":" + String(mins).padStart(2, "0");
}

// 10. Show the open day's stops as a timeline (and on the map)
function showStops() {
  const stops = currentDay.stops;

  // Put the stops in time order
  stops.sort(function (a, b) {
    return toMinutes(a.time) - toMinutes(b.time);
  });

  showHistory();
  updateMap(); 
  showNowNext();
  showCalendar();

  if (stops.length === 0) {
    stopList.innerHTML = "<p>No stops yet.</p>";
    return;
  }

  let html = "";
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const end = toMinutes(stop.time) + stop.duration;

    // If the stop was moved, show its original time crossed out
    let timeText = stop.duration > 0 ? `${stop.time}–${toTime(end)}` : stop.time;
    if (stop.originalTime && stop.originalTime !== stop.time) {
      timeText = `<s>${stop.originalTime}</s>${timeText}`;
    }

    html += `<div class="stop ${isHappeningNow(stop) ? "now" : ""}" id="stop-${i}">`;
    html += `<div><span class="stop-time">${timeText}</span>`;
    html += `<span class="badge ${stop.type}">${stop.type}</span></div>`;
    html += `<div class="stop-name">${i + 1}. ${stop.name}</div>`;
    if (stop.visited) {
      html += `<div class="small">✅ Visited</div>`;
    }
    if (stop.address) {
      html += `<div class="small">📍 ${stop.address}</div>`;
    }
    if (stop.notes) {
      html += `<div class="small">📝 ${stop.notes}</div>`;
    }
    if (stop.opens) {
      if (toMinutes(stop.time) < toMinutes(stop.opens)) {
        html += `<div class="small warning">🕙 Opens at ${stop.opens}, but you'd arrive at ${stop.time}</div>`;
      } else {
        html += `<div class="small">🕙 Opens at ${stop.opens}</div>`;
      }
    }
    if (stop.closes) {
      if (end > toMinutes(stop.closes)) {
        html += `<div class="small warning">🕔 Closes at ${stop.closes}, but you'd be here until ${toTime(end)}</div>`;
      } else {
        html += `<div class="small">🕔 Closes at ${stop.closes}</div>`;
      }
    }
    html += wishlistForStop(stop);
    html += nearbySaved(stop);
    html += shopsHtml(stop, i);
    const previous = stops[i - 1]; // undefined for the first stop
    const fromText = previous ? `from ${previous.name}` : "from where I am";
    html += `<a class="directions" href="${appleMapsLink(stop, previous)}" target="_blank">🧭 Directions ${fromText}</a><br>`;
    if (stop.lat) {
      html += `<button class="edit-button" onclick="showOnMap(${i})">📍 Map</button>`;
    }
    html += `<button class="edit-button" onclick="editStop(${i})">Edit</button>`;
    html += `<button class="edit-button" onclick="unscheduleStop(${i})">Move to Places</button>`;
    html += `<button class="delete-button" onclick="deleteStop(${i})">Delete</button>`;
    html += `</div>`;

    // The gap between this stop and the next one
    const next = stops[i + 1];
    if (next) {
      const arrive = end + stop.travel;
      const spare = toMinutes(next.time) - arrive;
      let gapText = `${stop.travelIcon || "🚶"} ${stop.travel} min to next stop`;
      if (spare > 0) {
        gapText += ` · ${niceLength(spare)} free`;
      }
      if (spare < 0) {
        gapText = `<span class="warning">⚠️ ${gapText} · ${niceLength(-spare)} short</span>`;
      }
      
        html += `<div class="gap">${gapText}${estimateButtons(i, stop, next)}</div>`;
    }
  }
  stopList.innerHTML = html;
}

// 11. Delete a stop (always ask first)
function deleteStop(i) {
  const stop = currentDay.stops[i];
  if (!confirm(`Delete "${stop.name}"?`)) {
    return;
  }
  hideSuggestions();
  resetStopForm(); // in case you were editing a stop
  remember(`Deleted ${stop.name}`);
  currentDay.stops.splice(i, 1);
  saveTrip();
  showStops();
}

// 12. Edit a stop: fill the form with its details
function editStop(i) {
  const stop = currentDay.stops[i];
  editingIndex = i;
  hideSuggestions();

  document.getElementById("stop-name").value = stop.name;
  document.getElementById("stop-type").value = stop.type;
  document.getElementById("stop-time").value = stop.time;
  document.getElementById("stop-end").value = toTime(toMinutes(stop.time) + stop.duration);  
  document.getElementById("stop-travel").value = stop.travel;
  document.getElementById("stop-address").value = stop.address;
  document.getElementById("stop-notes").value = stop.notes;
  document.getElementById("stop-closes").value = stop.closes || "";
  document.getElementById("stop-opens").value = stop.opens || "";
  setFormPosition(stop.lat, stop.lng);

  stopFormTitle.textContent = `Edit: ${stop.name}`;
  stopSubmit.textContent = "Save changes";
  cancelEditButton.hidden = false;
  addStopDetails.open = true;
  addStopDetails.scrollIntoView({ behavior: "smooth" });
}

// 13. Put the form back to "Add a stop"
function resetStopForm() {
  editingIndex = null;
  stopForm.reset();
  setFormPosition(null, null);
  stopFormTitle.textContent = "+ Add a stop";
  stopSubmit.textContent = "Add stop";
  cancelEditButton.hidden = true;
  addStopDetails.open = false;
}

// 14. When the stop form is submitted: add a new stop, or save the edited one
stopForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // Work out how long the stop is from its start and end times
  const startTime = document.getElementById("stop-time").value;
  const endTime = document.getElementById("stop-end").value;
  const duration = toMinutes(endTime) - toMinutes(startTime);
  if (duration <= 0) {
    alert("The end time needs to be after the start time.");
    return;
  }

  const stop = {
    name: document.getElementById("stop-name").value,
    type: document.getElementById("stop-type").value,
    time: document.getElementById("stop-time").value,
    duration: duration,
    travel: Number(document.getElementById("stop-travel").value),
    address: document.getElementById("stop-address").value,
    notes: document.getElementById("stop-notes").value,
    closes: document.getElementById("stop-closes").value,
    opens: document.getElementById("stop-opens").value,
    lat: formLat,
    lng: formLng,
  };

  if (editingIndex === null) {
    remember(`Added ${stop.name}`);
    currentDay.stops.push(stop);
  } else {
    const oldStop = currentDay.stops[editingIndex];
    remember(`Edited ${oldStop.name}`);
    if (oldStop.originalTime) {
      stop.originalTime = oldStop.originalTime; // keep the time it was first planned for
    }
    if (oldStop.hotel) {
      stop.hotel = oldStop.hotel; // keep it marked as a hotel stop
    }
    stop.shops = oldStop.shops;         // keep its shop list…
    stop.directory = oldStop.directory; // …and directory link
    if (oldStop.travelIcon && oldStop.travel === stop.travel) {
      stop.travelIcon = oldStop.travelIcon; // keep 🚶/🚇/🚕 if the travel time didn't change
    }
    currentDay.stops[editingIndex] = stop;
  }

  saveTrip();
  resetStopForm();
  showStops(); // this also puts the stops in time order
  showSuggestions(stop, planChanges(stop));
});

// 14b. When you pick a start time, suggest an end time 1 hour later (you can change it)
document.getElementById("stop-time").addEventListener("change", function () {
  const endInput = document.getElementById("stop-end");
  if (endInput.value === "") {
    endInput.value = toTime(toMinutes(this.value) + 60);
  }
});


// 15. Work out what a changed stop does to the rest of the day
function planChanges(changedStop) {
  const stops = currentDay.stops;
  const moves = [];  // stops that need a new time
  const notes = [];  // other things to tell you
  const start = stops.indexOf(changedStop);

  // The earliest time you could arrive at the next stop
  let ready = toMinutes(changedStop.time) + changedStop.duration + changedStop.travel;

  for (let i = start + 1; i < stops.length; i++) {
    const stop = stops[i];
    const planned = toMinutes(stop.time);

    // On time? Then the free time soaks up the delay and nothing after this changes
    if (ready <= planned) {
      if (stop.type === "fixed" && moves.length > 0) {
        notes.push(`✅ Keep ${stop.name} at ${stop.time} unchanged.`);
      }
      break;
    }

    if (stop.type === "fixed") {
      // Fixed stops never move: warn instead
      notes.push(`⚠️ You'd arrive ${ready - planned} min late for ${stop.name} (fixed at ${stop.time}). Consider shortening or skipping something before it.`);
      ready = planned + stop.duration + stop.travel; // a booking still ends at its usual time
    } else {
      // Flexible and bonus stops move later, just enough to fit
      moves.push({ stop: stop, newTime: toTime(ready) });
      if (stop.closes && ready + stop.duration > toMinutes(stop.closes)) {
        const open = toMinutes(stop.closes) - ready; // minutes before it closes
        notes.push(open > 0
          ? `🕔 ${stop.name} closes at ${stop.closes}, so you'd only get ${open} min there.`
          : `🕔 ${stop.name} would already be closed (closes at ${stop.closes}). Maybe move it to another day?`);
      }
      ready = ready + stop.duration + stop.travel;
    }
  }

  return { moves: moves, notes: notes };
}

// 16. Show the "Your schedule has changed" box
function showSuggestions(changedStop, plan) {
  if (plan.moves.length === 0 && plan.notes.length === 0) {
    hideSuggestions();
    return;
  }
  pendingMoves = plan.moves;

  const end = toTime(toMinutes(changedStop.time) + changedStop.duration);
  let html = `<h3>Your schedule has changed</h3>`;
  html += `<p>${changedStop.name} now ends at ${end}. Suggested adjustments:</p>`;
  html += `<ul>`;
  for (const move of plan.moves) {
    if (move.stop.type === "bonus") {
      html += `<li>Move ${move.stop.name} to ${move.newTime} (it's a bonus stop, so you could skip it instead)</li>`;
    } else {
      html += `<li>Move ${move.stop.name} to ${move.newTime}</li>`;
    }
  }
  for (const note of plan.notes) {
    html += `<li>${note}</li>`;
  }
  html += `</ul>`;

  if (plan.moves.length > 0) {
    html += `<button onclick="acceptChanges()">Accept</button> `;
    html += `<button onclick="hideSuggestions()">No thanks, I'll adjust it myself</button>`;
  } else {
    html += `<button onclick="hideSuggestions()">OK</button>`;
  }
  if (planSqueeze(changedStop)) {
    html += `<button onclick="showSqueeze()">✂️ Make it fit</button>`;
  }

  suggestionsBox.innerHTML = html;
  suggestionsBox.hidden = false;
  suggestionsBox.scrollIntoView({ behavior: "smooth" });
}

// 17. Your answer to the suggestions
function acceptChanges() {
  remember("Accepted suggested changes");
  for (const move of pendingMoves) {
    if (!move.stop.originalTime) {
      move.stop.originalTime = move.stop.time; // remember where it started
    }
    move.stop.time = move.newTime;
  }
  saveTrip();
  hideSuggestions();
  showStops();
}

function hideSuggestions() {
  pendingMoves = [];
  suggestionsBox.hidden = true;
}

// 18. Undo and change history
function remember(label) {
  if (!currentDay.history) {
    currentDay.history = [];
  }
  currentDay.history.push({
    label: label,
    at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    stops: JSON.stringify(currentDay.stops), // a snapshot of the day before the change
    places: JSON.stringify(trip.places || []), // …and of Places, since stops can move to/from there
  });
  if (currentDay.history.length > 20) {
    currentDay.history.shift(); // only keep the last 20 changes
  }
}

function undo() {
  const last = currentDay.history.pop();
  if (!last) {
    return;
  }
  currentDay.stops = JSON.parse(last.stops);
  if (last.places) {
    trip.places = JSON.parse(last.places); // put Places back the way it was too
  }
  hideSuggestions();
  resetStopForm();
  saveTrip();
  showStops();
}

function showHistory() {
  const history = currentDay.history || [];
  if (history.length === 0) {
    historyArea.innerHTML = "";
    return;
  }

  const last = history[history.length - 1];
  let html = `<button onclick="undo()">↩️ Undo: ${last.label}</button>`;
  html += `<details><summary>Change history (${history.length})</summary><ul>`;
  for (let i = history.length - 1; i >= 0; i--) {
    html += `<li>${history[i].at} — ${history[i].label}</li>`;
  }
  html += `</ul></details>`;
  historyArea.innerHTML = html;
}

// 19. Buttons
newTripButton.addEventListener("click", function () {
  showScreen("new-trip");
});

backButton.addEventListener("click", function () {
  showScreen("trip-section");
});

cancelEditButton.addEventListener("click", function () {
  resetStopForm();
});

// Save the day's theme when you type one
document.getElementById("day-focus").addEventListener("change", function () {
  currentDay.focus = this.value.trim();
  saveTrip();
});

// 20. Starting the app now happens in start.js (loaded last)
// today.js — "Today" mode: what's happening now, and what's next

// 🧪 Testing trick: add ?now=2026-11-26T10:45 to the end of the address
//    to pretend it's that day and time. Without it, the real clock is used.
const pretendNow = new URLSearchParams(location.search).get("now");

// 1. What time is it? (the real time, or the pretend time while testing)
function getNow() {
  return pretendNow ? new Date(pretendNow) : new Date();
}

// 2. Today's date as "2026-11-26", the same format the days use
function todayDate() {
  const now = getNow();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// 3. Minutes since midnight right now (10:45 -> 645)
function nowMinutes() {
  const now = getNow();
  return now.getHours() * 60 + now.getMinutes();
}

// 4. Is the day that's open today?
function isTodayOpen() {
  return currentDay !== null && currentDay.date === todayDate();
}

// 5. Is this stop happening right now?
function isHappeningNow(stop) {
  if (!isTodayOpen()) {
    return false;
  }
  const start = toMinutes(stop.time);
  return start <= nowMinutes() && nowMinutes() < start + stop.duration;
}

// 6. Friendly lengths: 85 -> "1 h 25 min"
function niceLength(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// 7. The 📍 Today tab: open today's day of the trip
function openToday() {
  const i = trip.days.findIndex((day) => day.date === todayDate());
  if (i !== -1) {
    openDay(i);
    return;
  }

  const first = trip.days[0];
  if (todayDate() < first.date) {
    const oneDay = 24 * 60 * 60 * 1000; // a day in milliseconds
    const daysToGo = Math.round((new Date(first.date + "T12:00") - new Date(todayDate() + "T12:00")) / oneDay);
    alert(`Your trip starts in ${daysToGo} day${daysToGo === 1 ? "" : "s"} (${first.label}). Today mode will light up then! ✈️`);
  } else {
    alert("This trip has finished. Hope it was lovely! 🌿");
  }
}

// 8. Find the stop happening now, and the next one coming up
function findNowNext() {
  const now = nowMinutes();
  let current = null;
  let next = null;
  for (const stop of currentDay.stops) { // already in time order
    const start = toMinutes(stop.time);
    if (start <= now && now < start + stop.duration) {
      current = stop;
    }
    if (start > now && next === null) {
      next = stop;
    }
  }
  return { current: current, next: next };
}

// 9. The "Now / Next" card at the top of today's timeline
function showNowNext() {
  const box = document.getElementById("now-next");
  if (!isTodayOpen()) {
    box.hidden = true;
    return;
  }

  const now = nowMinutes();
  const { current, next } = findNowNext();

  let html = `<div class="now-label">📍 Today · ${toTime(now)}</div>`;
  if (current) {
    const end = toMinutes(current.time) + current.duration;
    html += `<p><b>Now:</b> ${current.name}<br>`;
    html += `<span class="small">until ${toTime(end)} · ${niceLength(end - now)} left</span></p>`;
  }
  if (next) {
    html += `<p><b>Next:</b> ${next.name} at ${next.time}<br>`;
    html += `<span class="small">in ${niceLength(toMinutes(next.time) - now)}</span></p>`;
    html += `<a class="directions" href="${appleMapsLink(next, current)}" target="_blank">🧭 Directions to ${next.name}</a>`;
  }
  if (current || next) {
    html += `<div class="late-row">⏱️ Running late?`;
    for (const minutes of [15, 30, 60]) {
      html += `<button class="late-button" onclick="runningLate(${minutes})">+${minutes}</button>`;
    }
    html += `</div>`;
  } else {
    html += currentDay.stops.length > 0
      ? `<p>All done for today. Rest well! 🌙</p>`
      : `<p>Nothing planned today. Enjoy wandering! 🌿</p>`;
      html += tomorrowHtml();
    }

  html += `<button class="what-now-button" onclick="whatNow(false)">🧭 What now?</button>`;
  box.innerHTML = html;
  box.hidden = false;
}

// 10. "I'm running late": stay longer where you are, or start the next stop later
function runningLate(minutes) {
  const { current, next } = findNowNext();

  if (!current && next.type === "fixed") {
    alert(`${next.name} is fixed, so it can't move. Try to get there by ${next.time}! 🏃`);
    return;
  }

  remember(`Running ${minutes} min late`);
  let changed;
  if (current) {
    current.duration += minutes; // you're staying longer where you are
    changed = current;
  } else {
    if (!next.originalTime) {
      next.originalTime = next.time;
    }
    next.time = toTime(toMinutes(next.time) + minutes); // you'll get there later
    changed = next;
  }

  saveTrip();
  showStops();
  showSuggestions(changed, planChanges(changed)); // suggests moving the rest of the day
}

// 11. "Make it fit": if a fixed stop (like "Back at hotel" at 21:00) would be late,
//     work out how to squeeze the stops before it. Returns null if there's nothing to do.
let squeezePlan = null;

function planSqueeze(changedStop) {
  const stops = currentDay.stops;
  const ready = toMinutes(changedStop.time) + changedStop.duration + changedStop.travel;

  // The stops between the change and the next fixed stop (the "deadline")
  const between = [];
  let deadline = null;
  for (let i = stops.indexOf(changedStop) + 1; i < stops.length; i++) {
    if (stops[i].type === "fixed") {
      deadline = stops[i];
      break;
    }
    between.push(stops[i]);
  }
  if (deadline === null) {
    return null;
  }

  const lengths = between.map((stop) => stop.duration); // how long each one will be
  const skipped = between.map(() => false);              // which ones we skip

  // When would we reach the deadline, with these lengths and skips?
  function arrival() {
    let time = ready;
    for (let i = 0; i < between.length; i++) {
      if (!skipped[i]) {
        time = Math.max(time, toMinutes(between[i].time)) + lengths[i] + between[i].travel;
      }
    }
    return time;
  }

  const target = toMinutes(deadline.time);
  if (arrival() <= target) {
    return null; // already on time
  }

  // Step 1: skip bonus stops (last one first), but only if it actually helps
  for (let i = between.length - 1; i >= 0 && arrival() > target; i--) {
    if (between[i].type === "bonus") {
      const before = arrival();
      skipped[i] = true;
      if (arrival() >= before) {
        skipped[i] = false;
      }
    }
  }

  // Step 2: shorten flexible stops evenly, 5 min at a time, never below half
  let shrinking = true;
  while (arrival() > target && shrinking) {
    shrinking = false;
    for (let i = 0; i < between.length && arrival() > target; i++) {
      const shortest = Math.ceil(between[i].duration / 2 / 5) * 5;
      if (!skipped[i] && between[i].type === "flexible" && lengths[i] - 5 >= shortest) {
        const before = arrival();
        lengths[i] -= 5;
        if (arrival() < before) {
          shrinking = true;
        } else {
          lengths[i] += 5; // didn't help, so put it back
        }
      }
    }
  }

  // Collect the plan
  const skips = [];
  const shortenings = [];
  for (let i = 0; i < between.length; i++) {
    if (skipped[i]) {
      skips.push(between[i]);
    } else if (lengths[i] !== between[i].duration) {
      shortenings.push({ stop: between[i], newDuration: lengths[i] });
    }
  }
  if (skips.length === 0 && shortenings.length === 0) {
    return null; // nothing we can squeeze
  }

  squeezePlan = { changedStop: changedStop, deadline: deadline, skips: skips, shortenings: shortenings, arrive: arrival() };
  return squeezePlan;
}

// 12. Show the "Make it fit" plan in the suggestions box
function showSqueeze() {
  const plan = squeezePlan;
  let html = `<h3>✂️ Make it fit</h3>`;
  html += `<p>To reach <b>${plan.deadline.name}</b> by ${plan.deadline.time}:</p><ul>`;
  for (const stop of plan.skips) {
    html += `<li>Skip ${stop.name} (bonus). It goes back to ⭐ Places for another day.</li>`;
  }
  for (const change of plan.shortenings) {
    html += `<li>${change.stop.name}: ${niceLength(change.stop.duration)} → ${niceLength(change.newDuration)}</li>`;
  }
  html += `</ul>`;

  const late = plan.arrive - toMinutes(plan.deadline.time);
  if (late > 0) {
    html += `<p>⚠️ Even with this you'd be ${niceLength(late)} late. Maybe skip another stop too?</p>`;
  } else {
    html += `<p>✅ You'd get there by ${toTime(plan.arrive)}.</p>`;
  }
  html += `<button onclick="acceptSqueeze()">Accept</button> `;
  html += `<button onclick="hideSuggestions()">No thanks</button>`;

  suggestionsBox.innerHTML = html;
  suggestionsBox.scrollIntoView({ behavior: "smooth" });
}

// 13. Accept "Make it fit": skip, shorten, then move the rest of the day
function acceptSqueeze() {
  const plan = squeezePlan;
  remember("Made the day fit");

  for (const stop of plan.skips) {
    currentDay.stops.splice(currentDay.stops.indexOf(stop), 1);
    getPlaces().push(placeFromStop(stop));
  }
  for (const change of plan.shortenings) {
    change.stop.duration = change.newDuration;
  }
  for (const move of planChanges(plan.changedStop).moves) {
    if (!move.stop.originalTime) {
      move.stop.originalTime = move.stop.time;
    }
    move.stop.time = move.newTime;
  }

  saveTrip();
  hideSuggestions();
  showStops();
}

// 14. Keep it up to date: every minute, and when you come back to the app
setInterval(function () {
  if (!dayView.hidden) {
    showNowNext();
  }
}, 60 * 1000);

document.addEventListener("visibilitychange", function () {
  if (!document.hidden && !dayView.hidden) {
    showStops();
  }
});

// 15. "🌙 Tomorrow": a peek at the next day, shown once today is done
function tomorrowHtml() {
  const tomorrow = trip.days[trip.days.indexOf(currentDay) + 1];
  if (!tomorrow) {
    return `<p class="small">✈️ That was the last day. Safe travels home!</p>`;
  }
  const stops = tomorrow.stops.slice().sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const leave = stops.find((stop) => stop.hotel === "start");
  const first = stops.find((stop) => !stop.hotel);
  let text = "🌙 Tomorrow:";
  if (leave) {
    text += ` leave the hotel at ${leave.time}.`;
  }
  text += first ? ` First stop: ${first.name} at ${first.time}.` : " nothing planned yet.";
  if (tomorrow.focus) {
    text += ` (${tomorrow.focus})`;
  }
  return `<p class="small">${text}</p>`;
}

// 16. "✈️ 4 days to go!" on the trip screen
function countdownHtml() {
  const first = trip.days[0].date;
  const last = trip.days[trip.days.length - 1].date;
  const today = todayDate();
  const oneDay = 24 * 60 * 60 * 1000;
  let text;
  if (today < first) {
    const daysToGo = Math.round((new Date(first + "T12:00") - new Date(today + "T12:00")) / oneDay);
    text = daysToGo === 1 ? "✈️ Tomorrow! Pack your bags 🧳" : `✈️ ${daysToGo} days to go!`;
  } else if (today <= last) {
    const day = trip.days.find((d) => d.date === today);
    text = `🌿 Day ${day.number} of ${trip.days.length}. Enjoy!`;
  } else {
    text = "🌿 Hope it was a lovely trip!";
  }
  return `<p class="countdown">${text}</p>`;
}
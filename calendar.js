// calendar.js — a calendar view of the day where you can drag stops around

const calendarView = document.getElementById("calendar-view");
let calendarStart = 0; // the time (in minutes) at the top of the calendar
let drag = null;       // the stop being pressed or dragged right now

// 1. List or calendar? Remember your choice on this device
let dayLayout = "list";
try {
  dayLayout = localStorage.getItem("dayLayout") || "list";
} catch (error) {
  // storage not available: just use the list
}

function setLayout(layout) {
  dayLayout = layout;
  try {
    localStorage.setItem("dayLayout", layout);
  } catch (error) {}
  showCalendar();
}

// 2. Draw the calendar: 1 pixel = 1 minute, so 1 hour = 60 pixels
function showCalendar() {
  const isCalendar = dayLayout === "calendar";
  stopList.hidden = isCalendar;
  calendarView.hidden = !isCalendar;
  document.getElementById("calendar-hint").hidden = !isCalendar;
  document.getElementById("list-button").classList.toggle("active", !isCalendar);
  document.getElementById("calendar-button").classList.toggle("active", isCalendar);
  if (!isCalendar) {
    return;
  }

  // Show at least 7:00–22:00, and stretch if stops are earlier or later
  const stops = currentDay.stops;
  let first = 7 * 60;
  let last = 22 * 60;
  for (const stop of stops) {
    first = Math.min(first, Math.floor(toMinutes(stop.time) / 60) * 60);
    last = Math.max(last, Math.ceil((toMinutes(stop.time) + stop.duration + stop.travel) / 60) * 60);
  }
  calendarStart = first;

  let html = "";
  for (let minute = first; minute <= last; minute += 60) {
    html += `<div class="hour-line" style="top: ${minute - first}px"><span>${toTime(minute)}</span></div>`;
  }

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const top = toMinutes(stop.time) - first;
    const end = toTime(toMinutes(stop.time) + stop.duration);

    // Travel time after the stop, as a striped area
    if (stop.travel > 0) {
      html += `<div class="travel-block" style="top: ${top + stop.duration}px; height: ${stop.travel}px"></div>`;
    }

    html += `<div class="cal-block ${stop.type} ${stop.duration === 0 ? "moment" : ""}" id="cal-${i}"
      style="top: ${top}px; height: ${Math.max(stop.duration, 24)}px"
      onpointerdown="startPress(event, ${i}, 'move')">`;
    html += `<b>${stop.type === "fixed" ? "🔒 " : ""}${stop.name}</b>`;
    html += `<span class="cal-time">${stop.duration > 0 ? `${stop.time}–${end}` : stop.time}</span>`;
    html += `<button class="cal-delete" onpointerdown="event.stopPropagation()" onclick="deleteStop(${i})">×</button>`;
    if (stop.type !== "fixed" && stop.duration > 0) {
      html += `<div class="resize-handle" onpointerdown="event.stopPropagation(); startPress(event, ${i}, 'resize')"></div>`;
    }
    html += `</div>`;
  }

  // A red line for "now", like Apple Calendar
  if (isTodayOpen() && nowMinutes() >= first && nowMinutes() <= last) {
    html += `<div class="now-line" style="top: ${nowMinutes() - first}px"></div>`;
  }

  calendarView.innerHTML = html;
  calendarView.style.height = `${last - first}px`;
}

// 3. Press on a stop. Mouse: drag straight away. Finger: hold for a moment first,
//    so a normal swipe still scrolls the page.
function startPress(event, i, mode) {
  const stop = currentDay.stops[i];
  const press = {
    i: i,
    mode: mode, // "move" or "resize"
    stop: stop,
    block: document.getElementById(`cal-${i}`),
    startY: event.clientY,
    startTime: toMinutes(stop.time),
    startDuration: stop.duration,
    active: false,
    delta: 0,
    timer: null,
  };
  drag = press;

  if (stop.type === "fixed") {
    return; // fixed stops can be tapped (to edit) but never dragged
  }
  if (event.pointerType === "mouse" || mode === "resize") {
    press.active = true;
  } else {
    press.timer = setTimeout(function () {
      if (drag === press) {
        press.active = true;
        press.block.classList.add("dragging");
      }
    }, 300);
  }
}

// 4. Moving: follow the finger/mouse, snapping to 5 minutes
document.addEventListener("pointermove", function (event) {
  if (!drag) {
    return;
  }
  const dy = event.clientY - drag.startY;
  if (!drag.active) {
    if (Math.abs(dy) > 8) {
      cancelPress(); // you're scrolling, not dragging
    }
    return;
  }

  drag.block.classList.add("dragging");
  drag.delta = Math.round(dy / 5) * 5; // 1 pixel = 1 minute, snapped to 5
  const label = drag.block.querySelector(".cal-time");
  if (drag.mode === "move") {
    const start = Math.min(Math.max(drag.startTime + drag.delta, 0), 23 * 60 + 55);
    drag.block.style.top = `${start - calendarStart}px`;
    label.textContent = drag.startDuration > 0 ? `${toTime(start)}–${toTime(start + drag.startDuration)}` : toTime(start);
  } else {
    const length = Math.max(5, drag.startDuration + drag.delta);
    drag.block.style.height = `${Math.max(length, 24)}px`;
    label.textContent = `${toTime(drag.startTime)}–${toTime(drag.startTime + length)}`;
  }
});

// 5. While dragging with a finger, stop the page from scrolling
document.addEventListener("touchmove", function (event) {
  if (drag && drag.active) {
    event.preventDefault();
  }
}, { passive: false });

// 6. Let go: a tap opens the stop for editing; a drag saves the new time
document.addEventListener("pointerup", function () {
  if (!drag) {
    return;
  }
  const press = drag;
  clearTimeout(press.timer);
  drag = null;

  if (press.delta === 0) {
    showCalendar();
    editStop(press.i); // it was a tap
    return;
  }

  const stop = press.stop;
  if (press.mode === "move") {
    const newTime = toTime(Math.min(Math.max(press.startTime + press.delta, 0), 23 * 60 + 55));
    remember(`Moved ${stop.name} to ${newTime}`);
    stop.time = newTime;
  } else {
    const length = Math.max(5, press.startDuration + press.delta);
    remember(`${stop.name} now ends at ${toTime(press.startTime + length)}`);
    stop.duration = length;
  }

  saveTrip();
  hideSuggestions();
  showStops();
  showSuggestions(stop, planChanges(stop)); // the rest of the day may need to move
});

// 7. Cancelled (e.g. the phone took over for scrolling): put things back
function cancelPress() {
  if (drag) {
    clearTimeout(drag.timer);
    drag = null;
    showCalendar();
  }
}
document.addEventListener("pointercancel", cancelPress);

// 8. Tap an empty spot on the calendar: add a stop at that time
calendarView.addEventListener("click", function (event) {
  if (event.target.closest(".cal-block")) {
    return; // that was a stop, not an empty spot
  }
  const y = event.clientY - calendarView.getBoundingClientRect().top;
  const start = calendarStart + Math.floor(y / 15) * 15; // snap to the quarter hour
  resetStopForm();
  document.getElementById("stop-time").value = toTime(start);
  document.getElementById("stop-end").value = toTime(start + 60);
  addStopDetails.open = true;
  addStopDetails.scrollIntoView({ behavior: "smooth" });
});
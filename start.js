// start.js — starts the app. It's loaded LAST, so every other file is ready first.

// When the page opens: show the saved trip, or the new trip form
const savedTrip = localStorage.getItem("trip");
if (savedTrip) {
  trip = JSON.parse(savedTrip);
  showTrip();
} else {
  showScreen("new-trip");
}
// hotel.js — your hotel at the start and end of every day

const hotelBox = document.getElementById("hotel-box");
const hotelForm = document.getElementById("hotel-form");
const hotelResult = document.getElementById("hotel-result");

// 1. When the box opens, fill it in with what you saved last time
hotelBox.addEventListener("toggle", function () {
  if (!hotelBox.open) {
    return;
  }
  const hotel = trip.hotel || { name: "", address: "", leave: "08:30", back: "21:00" };
  document.getElementById("hotel-name").value = hotel.name;
  document.getElementById("hotel-address").value = hotel.address;
  document.getElementById("hotel-leave").value = hotel.leave;
  document.getElementById("hotel-back").value = hotel.back;
  hotelResult.textContent = "";
});

// 2. Find the hotel on the map, so directions and travel estimates work
async function findHotel(hotel) {
  const query = hotel.address || `${hotel.name}, ${trip.destination}`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    const results = await response.json();
    if (results.length > 0) {
      hotel.lat = Number(results[0].lat);
      hotel.lng = Number(results[0].lon);
    }
  } catch (error) {
    // Offline or search failed: carry on without a pin
  }
}

// 3. Put a hotel stop on one day: update it if it's already there, add it if not
function setHotelStop(day, which, details) {
  let stop = day.stops.find((s) => s.hotel === which);
  if (!stop) {
    stop = { hotel: which, notes: "", closes: "", travel: which === "start" ? 15 : 0 };
    day.stops.push(stop);
  }
  Object.assign(stop, details);
  delete stop.originalTime; // it's a fresh time now
}

// 4. "Add to every day"
hotelForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const hotel = {
    name: document.getElementById("hotel-name").value,
    address: document.getElementById("hotel-address").value,
    leave: document.getElementById("hotel-leave").value,
    back: document.getElementById("hotel-back").value,
  };
  if (toMinutes(hotel.back) <= toMinutes(hotel.leave)) {
    alert("\"Back by\" needs to be after \"Leave at\".");
    return;
  }
  if (!confirm(`Add "Leave ${hotel.name}" at ${hotel.leave} and "Back at ${hotel.name}" at ${hotel.back} to all ${trip.days.length} days?`)) {
    return;
  }

  hotelResult.textContent = "🔍 Finding your hotel on the map…";
  await findHotel(hotel);
  trip.hotel = hotel;

  for (const day of trip.days) {
    currentDay = day; // so Undo works on each day
    remember("Added hotel times");
    const where = { address: hotel.address, lat: hotel.lat || null, lng: hotel.lng || null, duration: 0 };
    setHotelStop(day, "start", Object.assign({}, where, { name: `🏨 Leave ${hotel.name}`, type: "flexible", time: hotel.leave }));
    setHotelStop(day, "end", Object.assign({}, where, { name: `🏨 Back at ${hotel.name}`, type: "fixed", time: hotel.back }));
  }
  currentDay = null;
  saveTrip();

  hotelResult.textContent = hotel.lat
    ? "✅ Added to every day, with a map pin."
    : "✅ Added to every day. (Couldn't find it on the map, but that's OK.)";
});
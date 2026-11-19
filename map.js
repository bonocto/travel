// Day map: the open day's stops as numbered pins (Leaflet + OpenStreetMap)

// 1. Find things on the page by their id
const mapBox = document.getElementById("day-map");
const mapHint = document.getElementById("map-hint");
const findResult = document.getElementById("find-result");

// 2. Map data
let map = null;       // the Leaflet map (made the first time it's needed)
let pinLayer = null;  // holds all the pins, so they can be cleared and redrawn
let markers = [];     // the pin for each stop, in timeline order (null = no pin)
let tempPin = null;   // a pin you placed by tapping the map
let formLat = null;   // coordinates for the stop in the form
let formLng = null;

const typeColours = { fixed: "#3a3a3a", flexible: "#6b7a3a", bonus: "#6a8caf" };

// 3. Draw the open day's stops on the map
function updateMap() {
  const stops = currentDay.stops;

  // Only show the map if at least one stop has coordinates
  let hasPins = false;
  for (const stop of stops) {
    if (stop.lat) {
      hasPins = true;
    }
  }
  mapBox.hidden = !hasPins;
  mapHint.hidden = hasPins;
  if (!hasPins) {
    return;
  }

  // Make the map the first time
  if (!map) {
    map = L.map("day-map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    map.on("click", placePinFromMap);
  }
  map.invalidateSize(); // check the map's size, in case the screen changed

  // Clear the old pins and draw one for each stop
  pinLayer.clearLayers();
  tempPin = null;
  markers = [];
  const points = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop.lat) {
      markers.push(null);
      continue; // no coordinates: skip this one
    }
    const marker = L.marker([stop.lat, stop.lng], { icon: makeIcon(i + 1, typeColours[stop.type]) })
      .bindPopup(`<b>${i + 1}. ${stop.name}</b><br>${stop.time}`)
      .addTo(pinLayer);
    marker.on("click", function () {
      highlightStop(i);
    });
    markers.push(marker);
    points.push([stop.lat, stop.lng]);
  }

  // A dashed line joining the pins in timeline order
  if (points.length > 1) {
    L.polyline(points, { color: "#6b7a3a", weight: 3, dashArray: "6 8" }).addTo(pinLayer);
  }

  // Zoom so every pin fits
  if (points.length === 1) {
    map.setView(points[0], 15);
  } else {
    map.fitBounds(points, { padding: [30, 30] });
  }
}

// 4. A round pin with a label (a number, or "+")
function makeIcon(label, colour) {
  return L.divIcon({
    className: "",
    html: `<div class="pin" style="background:${colour}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// 5. Set (or clear) the coordinates for the stop in the form
function setFormPosition(lat, lng) {
  formLat = lat || null;
  formLng = lng || null;
  findResult.textContent = formLat ? "📍 This stop is on the map." : "";
  if (tempPin) {
    tempPin.remove();
    tempPin = null;
  }
}

// 6. Look up the address (or place name) and get its coordinates
async function findOnMap() {
  const name = document.getElementById("stop-name").value;
  const address = document.getElementById("stop-address").value;
  if (!name && !address) {
    alert("Type a place name or an address first.");
    return;
  }
  const query = address || `${name}, ${trip.destination}`;
  findResult.textContent = "Searching…";

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const results = await response.json();

    if (results.length === 0) {
      findResult.textContent = "Couldn't find that. Try a fuller address, or tap the map.";
      return;
    }
    formLat = Number(results[0].lat);
    formLng = Number(results[0].lon);
    findResult.textContent = `✅ Found: ${results[0].display_name}`;
  } catch (error) {
    findResult.textContent = "Search failed. Are you online?";
  }
}

// 7. If you change the address, the old coordinates may be wrong
document.getElementById("stop-address").addEventListener("input", function () {
  if (formLat) {
    formLat = null;
    formLng = null;
    findResult.textContent = "Address changed. Tap 🔍 Find on map again.";
  }
});

// 8. A link that opens directions in Apple Maps
//    (from the previous stop, or from where you are if it's the first stop)
function appleMapsLink(stop, previousStop) {
  let url = `https://maps.apple.com/?daddr=${placeFor(stop)}`;
  if (previousStop) {
    url += `&saddr=${placeFor(previousStop)}`;
  }
  return url;
}

// How to describe a stop to Apple Maps: coordinates if we have them, otherwise words
function placeFor(stop) {
  if (stop.lat) {
    return `${stop.lat},${stop.lng}`;
  }
  return encodeURIComponent(stop.address || `${stop.name}, ${trip.destination}`);
}

// 9. Tap a pin: scroll to that stop in the timeline and make it glow
function highlightStop(i) {
  const card = document.getElementById(`stop-${i}`);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("highlight");
  setTimeout(function () {
    card.classList.remove("highlight");
  }, 1500);
}

// 10. Tap "📍 Map" on a stop: jump to its pin
function showOnMap(i) {
  const marker = markers[i];
  mapBox.scrollIntoView({ behavior: "smooth" });
  map.setView(marker.getLatLng(), 16);
  marker.openPopup();
}

// 11. Tap the map while the stop form is open: put the stop there
function placePinFromMap(event) {
  if (!addStopDetails.open) {
    return; // only when you're adding or editing a stop
  }
  formLat = event.latlng.lat;
  formLng = event.latlng.lng;
  if (tempPin) {
    tempPin.remove();
  }
  tempPin = L.marker(event.latlng, { icon: makeIcon("+", "#b3261e") }).addTo(pinLayer);
  findResult.textContent = "📍 Pin placed from the map. Tap Save to keep it.";
}
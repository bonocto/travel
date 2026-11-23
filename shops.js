// shops.js — "My shops here": your own shop list for a mall (or market, or street)
// Paste shops one per line, like "Muji B1-10", and they're sorted by floor.
// A shop list can live on a stop in a day ("stop-3") or on a saved place ("place-2"),
// and it travels with it when you add a place to a day (or move a stop back to Places).

let openShopsFor = null; // the stop or place whose shop list is open, so it stays open after changes

// 1. Split a line like "Uniqlo #02-15" into a name and a unit
function parseShopLine(line) {
  const match = line.match(/\s*[,@–-]?\s*(#?\s*(?:B|L)?\d{1,2}\s*-\s*\d{1,3}[A-Z]?)\s*$/i);
  if (match) {
    return { name: line.slice(0, match.index).trim(), unit: match[1].replace(/\s+/g, "") };
  }
  return { name: line.trim(), unit: "" };
}

// 2. Which floor is a unit on? "B1-10" -> -1, "#02-15" -> 2, no unit -> 99 (at the end)
function floorOf(unit) {
  const match = unit.replace("#", "").match(/^(B|L)?(\d{1,2})/i);
  if (!match) {
    return 99;
  }
  const level = Number(match[2]);
  return match[1] && match[1].toUpperCase() === "B" ? -level : level;
}

// 3. Is a Don't Forget item sold at one of this stop's shops?
function soldInShops(item, stop) {
  return (stop.shops || []).some((shop) => soldAt(item, shop.name));
}

// 3b. Which stop or place does a key like "stop-3" or "place-2" mean?
function shopOwner(key) {
  const [kind, i] = key.split("-");
  return kind === "place" ? getPlaces()[Number(i)] : currentDay.stops[Number(i)];
}

// 3c. Redraw whichever screen the shop list is on
function refreshShops(key) {
  if (key.startsWith("place")) {
    showPlaces();
  } else {
    showStops();
  }
}

// 4. The shop list on a stop card or a place card
function shopsHtml(owner, key) {
  const shops = owner.shops || [];
  const isOpen = openShopsFor === owner;
  if (shops.length === 0 && !isOpen) {
    return `<button class="edit-button" onclick="openShops('${key}')">🛍️ Shop list</button><br>`;
  }

  const starred = shops.filter((shop) => shop.star).length;
  let html = `<details class="shops-box" ${isOpen ? "open" : ""} ontoggle="shopsToggled('${key}', this.open)">`;
  html += `<summary class="small-summary">🛍️ My shops here (${shops.length}${starred ? ` · ${starred} ⭐` : ""})</summary>`;

  // Sorted by floor (then unit), but remembering each shop's real position
  const order = shops.map((shop, s) => s);
  order.sort((a, b) => floorOf(shops[a].unit) - floorOf(shops[b].unit) || shops[a].unit.localeCompare(shops[b].unit));

  for (const s of order) {
    const shop = shops[s];
    const toBuy = getWishlist().filter((item) => !item.bought && soldAt(item, shop.name));
    html += `<div class="shop-row ${shop.done ? "done" : ""}">`;
    html += `<input type="checkbox" ${shop.done ? "checked" : ""} onchange="toggleShopDone('${key}', ${s})">`;
    html += `<button class="star-button" onclick="toggleShopStar('${key}', ${s})">${shop.star ? "⭐" : "☆"}</button>`;
    html += `<span class="shop-name">${shop.name}`;
    if (toBuy.length > 0) {
      html += `<br><span class="small">🛍️ ${toBuy.map((item) => item.name).join(", ")}</span>`;
    }
    html += `</span>`;
    html += `<span class="shop-unit">${shop.unit}</span>`;
    html += `<button class="star-button" onclick="removeShop('${key}', ${s})">×</button>`;
    html += `</div>`;
  }

  html += `<textarea id="shops-paste-${key}" rows="3" placeholder="Paste shops, one per line:&#10;Muji B1-10&#10;Uniqlo #02-15"></textarea>`;
  html += `<button onclick="addShops('${key}')">Add shops</button>`;
  if (owner.directory) {
    html += `<p class="small">🔗 <a href="${owner.directory}" target="_blank">Open the full directory</a> · <a href="#" onclick="setDirectory('${key}'); return false;">change</a></p>`;
  } else {
    html += `<p class="small"><a href="#" onclick="setDirectory('${key}'); return false;">🔗 Save a link to the mall's directory</a></p>`;
  }
  html += `</details>`;
  return html;
}

// 5. Open, close and remember which list is open
function openShops(key) {
  openShopsFor = shopOwner(key);
  refreshShops(key);
}

function shopsToggled(key, isOpen) {
  const owner = shopOwner(key);
  if (isOpen) {
    openShopsFor = owner;
  } else if (openShopsFor === owner) {
    openShopsFor = null;
  }
}

// 6. "Add shops": read the pasted lines and add each one
function addShops(key) {
  const owner = shopOwner(key);
  const lines = document.getElementById(`shops-paste-${key}`).value.split("\n");
  if (!owner.shops) {
    owner.shops = [];
  }
  let added = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    const shop = parseShopLine(line);
    const already = owner.shops.some((s) => s.name.toLowerCase() === shop.name.toLowerCase());
    if (!already) {
      owner.shops.push({ name: shop.name, unit: shop.unit, star: false, done: false });
      added++;
    }
  }
  if (added === 0) {
    return;
  }
  openShopsFor = owner;
  saveTrip();
  refreshShops(key);
}

// 7. Star, tick off, or remove a shop
function toggleShopStar(key, s) {
  const shop = shopOwner(key).shops[s];
  shop.star = !shop.star;
  saveTrip();
  refreshShops(key);
}

function toggleShopDone(key, s) {
  const shop = shopOwner(key).shops[s];
  shop.done = !shop.done;
  saveTrip();
  refreshShops(key);
}

function removeShop(key, s) {
  const owner = shopOwner(key);
  if (!confirm(`Remove ${owner.shops[s].name} from the list?`)) {
    return;
  }
  owner.shops.splice(s, 1);
  saveTrip();
  refreshShops(key);
}

// 8. Save a link to the mall's own shop directory
function setDirectory(key) {
  const owner = shopOwner(key);
  const link = prompt("Paste the link to the mall's shop directory:", owner.directory || "https://");
  if (link === null) {
    return; // you pressed Cancel
  }
  owner.directory = link.startsWith("http") ? link.trim() : "";
  openShopsFor = owner;
  saveTrip();
  refreshShops(key);
}


// 9. Search every shop list in the trip (all days + Places)
function searchShops() {
  const query = document.getElementById("shop-search").value.trim().toLowerCase();
  const results = document.getElementById("shop-results");
  if (query === "") {
    results.innerHTML = "";
    return;
  }

  let html = "";
  function addRow(shop, where, button) {
    html += `<div class="shop-row ${shop.done ? "done" : ""}">`;
    html += `<span class="shop-name">${shop.star ? "⭐ " : ""}${shop.name}<br><span class="small">📍 ${where}</span></span>`;
    html += `<span class="shop-unit">${shop.unit}</span>`;
    html += button;
    html += `</div>`;
  }

  // Shops in the stops of every day
  trip.days.forEach(function (day, d) {
    for (const stop of day.stops) {
      for (const shop of stop.shops || []) {
        if (shop.name.toLowerCase().includes(query)) {
          addRow(shop, stop.name, `<button class="day-link" onclick="openDay(${d})">Day ${day.number} · ${stop.time}</button>`);
        }
      }
    }
  });

  // Shops in places that aren't in a day yet
  for (const place of getPlaces()) {
    for (const shop of place.shops || []) {
      if (shop.name.toLowerCase().includes(query)) {
        addRow(shop, place.name, `<span class="small">⭐ In Places</span>`);
      }
    }
  }

  results.innerHTML = html || `<p class="small">No shops matching "${query}" yet.</p>`;
}

document.getElementById("shop-search").addEventListener("input", searchShops);
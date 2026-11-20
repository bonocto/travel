// Don't Forget: a wishlist where every item is linked to the shops that sell it

// 1. Find things on the page by their id
const wishlistForm = document.getElementById("wishlist-form");
const wishlistList = document.getElementById("wishlist-list");
const wishlistSummary = document.getElementById("wishlist-summary");
const addItemDetails = document.getElementById("add-item");
const placeSuggestions = document.getElementById("place-suggestions");
const itemFormTitle = document.getElementById("item-form-title");
const itemSubmit = document.getElementById("item-submit");
const itemCancel = document.getElementById("item-cancel");
let editingItemIndex = null; // null = adding a new item, a number = editing that item

// 2. The wishlist lives inside the trip (created the first time it's needed)
function getWishlist() {
  if (!trip.wishlist) {
    trip.wishlist = [];
  }
  return trip.wishlist;
}

// 3. Open the Don't Forget screen
function openWishlist() {
  fillPlaceSuggestions();
  resetItemForm();
  showWishlist();
  showScreen("wishlist-view");
}

// 4. Suggest your stop names while typing "Where to buy"
function fillPlaceSuggestions() {
  let html = "";
  for (const day of trip.days) {
    for (const stop of day.stops) {
      html += `<option value="${stop.name}">`;
    }
  }
  for (const place of getPlaces()) {
    html += `<option value="${place.name}">`;
  }
  placeSuggestions.innerHTML = html;
}

// 5. Turn "Isetan, Beams" into a list: ["Isetan", "Beams"]
function shopList(item) {
  const names = [];
  for (const part of item.shops.split(",")) {
    const name = part.trim();
    if (name !== "") {
      names.push(name);
    }
  }
  return names;
}

// 6. Is this item sold at this place? (ignores capital letters)
function soldAt(item, placeName) {
  for (const name of shopList(item)) {
    if (name.toLowerCase() === placeName.toLowerCase()) {
      return true;
    }
  }
  return false;
}

// 7. Show the wishlist
function showWishlist() {
  const items = getWishlist();

  // Summary: how much is left to buy?
  let left = 0;
  let mustLeft = 0;
  for (const item of items) {
    if (!item.bought) {
      left++;
      if (item.priority === "must") {
        mustLeft++;
      }
    }
  }
  wishlistSummary.textContent = items.length === 0
    ? "Nothing on your list yet."
    : `${left} still to buy (${mustLeft} must-have).`;

  let html = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    html += `<div class="item ${item.bought ? "bought" : ""}">`;
    html += `<label class="check">`;
    html += `<input type="checkbox" onchange="toggleBought(${i})" ${item.bought ? "checked" : ""}>`;
    html += `<span class="item-name">${item.priority === "must" ? "⭐ " : ""}${item.name}</span>`;
    html += `</label>`;
    if (item.photo) {
      html += `<img class="item-photo" src="${item.photo}" onclick="viewPhoto(${i})" alt="">`;
    }
    if (item.price) {
      html += `<div class="small">💰 ${item.price}</div>`;
    }
    if (shopList(item).length > 0) {
      html += `<div class="small">📍 ${shopList(item).join(" · ")}</div>`;
    } else {
      html += `<div class="small warning">📍 No shop added yet</div>`;
    }
    if (item.notes) {
      html += `<div class="small">📝 ${item.notes}</div>`;
    }
    if (item.link) {
      html += `<div class="small">🔗 <a href="${item.link}" target="_blank">Open link</a></div>`;
    }
    html += `<button class="edit-button" onclick="editItem(${i})">Edit</button>`;
    html += `<button class="edit-button" onclick="choosePhoto(${i})">📷 ${item.photo ? "Change photo" : "Add photo"}</button>`;
    html += `<button class="edit-button" onclick="pastePhoto(${i})">📋 Paste photo</button>`;
    if (item.photo) {
      html += `<button class="delete-button" onclick="removePhoto(${i})">Remove photo</button>`;
    }
    html += `<button class="delete-button" onclick="deleteItem(${i})">Delete</button>`;
    html += `</div>`;
  }
  wishlistList.innerHTML = html;
}

// 8. Tick or untick "bought"
function toggleBought(i) {
  const item = getWishlist()[i];
  item.bought = !item.bought;
  saveTrip();
  showWishlist();
}

// 9. Delete an item (always ask first)
function deleteItem(i) {
  const item = getWishlist()[i];
  if (!confirm(`Delete "${item.name}"?`)) {
    return;
  }
  resetItemForm(); // in case you were editing it
  getWishlist().splice(i, 1);
  saveTrip();
  showWishlist();
}

// 10. Edit an item: fill the form with its details
function editItem(i) {
  const item = getWishlist()[i];
  editingItemIndex = i;

  document.getElementById("item-name").value = item.name;
  document.getElementById("item-shops").value = item.shops;
  document.getElementById("item-price").value = item.price;
  document.getElementById("item-priority").value = item.priority;
  document.getElementById("item-link").value = item.link;
  document.getElementById("item-notes").value = item.notes;

  itemFormTitle.textContent = `Edit: ${item.name}`;
  itemSubmit.textContent = "Save changes";
  itemCancel.hidden = false;
  addItemDetails.open = true;
  addItemDetails.scrollIntoView({ behavior: "smooth" });
}

// 10b. Put the form back to "Add an item"
function resetItemForm() {
  editingItemIndex = null;
  wishlistForm.reset();
  itemFormTitle.textContent = "+ Add an item";
  itemSubmit.textContent = "Add item";
  itemCancel.hidden = true;
  addItemDetails.open = false;
}

// 10c. When the form is saved: add a new item, or update the one being edited
wishlistForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const details = {
    name: document.getElementById("item-name").value,
    shops: document.getElementById("item-shops").value,
    price: document.getElementById("item-price").value,
    priority: document.getElementById("item-priority").value,
    link: document.getElementById("item-link").value,
    notes: document.getElementById("item-notes").value,
  };

  if (editingItemIndex === null) {
    details.bought = false;
    getWishlist().push(details);
  } else {
    // Copy the new details onto the old item (its photo and "bought" tick stay)
    Object.assign(getWishlist()[editingItemIndex], details);
  }

  saveTrip();
  resetItemForm();
  showWishlist();
});

// 11. On the timeline: remind you about items sold at this stop
function wishlistForStop(stop) {
  const items = getWishlist();
  let html = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.bought && (soldAt(item, stop.name) || soldInShops(item, stop))) {
        html += `<div class="reminder">`;
      if (item.photo) {
        html += `<img class="reminder-photo" src="${item.photo}" alt="">`;
      }
      html += `🛍️ Don't forget: ${item.name}`;
      if (item.price) {
        html += ` (${item.price})`;
      }
      html += `<button class="small-button" onclick="boughtAtStop(${i})">Bought ✓</button></div>`;
    }
  }
  return html;
}

function boughtAtStop(i) {
  getWishlist()[i].bought = true;
  saveTrip();
  showStops();
}
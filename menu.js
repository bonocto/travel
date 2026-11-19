// menu.js — the bottom menu and the floating + button
// (loaded BEFORE app.js, because app.js uses updateMenu() as soon as it starts)

const bottomNav = document.getElementById("bottom-nav");
const quickAddButton = document.getElementById("quick-add");

// 1. Which fold-out form the + button opens on each screen
const quickAddForms = {
  "day-view": "add-stop",
  "wishlist-view": "add-item",
  "places-view": "add-place",
};

// 2. Show the menu, light up the current tab, and show + where it's useful
function updateMenu(screenId) {
  bottomNav.hidden = screenId === "new-trip";
  quickAddButton.hidden = !quickAddForms[screenId];

  // A single day belongs to the Days tab
  const tabScreen = screenId === "day-view" ? "trip-section" : screenId;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.screen === tabScreen);
  }
}

// 3. The + button: open the right form and scroll to it
function quickAdd() {
  const screen = document.querySelector("section:not([hidden])");
  const form = document.getElementById(quickAddForms[screen.id]);
  form.open = true;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
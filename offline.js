// offline.js — switches on offline mode and shows the app's version

const appVersion = "15.3"; // ✏️ change this when you upload a new version (it's just a label)

// 1. Start the offline helper (sw.js). It only works on https or localhost.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
  navigator.serviceWorker.addEventListener("controllerchange", showAppStatus);
}

// 2. Show the version, and whether offline mode is ready yet
function showAppStatus() {
  let status = "⏳ offline mode starts next time you open the app";
  if (!("serviceWorker" in navigator)) {
    status = "offline mode only works on the https version";
  } else if (navigator.serviceWorker.controller) {
    status = "✈️ works offline";
  }
  document.getElementById("app-status").textContent = `Farefarren v${appVersion} · ${status}`;
}
showAppStatus();
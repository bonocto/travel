// backup.js — Export and Import a copy of the trip

// 1. The hidden file picker
const importFile = document.getElementById("import-file");

// 2. EXPORT: turn the trip into a file
async function exportTrip() {
  if (!trip) {
    alert("There's no trip to export yet.");
    return;
  }

  const text = JSON.stringify(trip, null, 2);
  const today = new Date().toISOString().slice(0, 10);
  const safeName = trip.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `trip-${safeName}-${today}.json`;
  const file = new File([text], fileName, { type: "application/json" });

  // On iPhone (once it's on https): open the Share sheet → AirDrop
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      markBackedUp();
      return;
    } catch (error) {
      if (error.name === "AbortError") return; // you pressed Cancel
    }
  }

  // Everywhere else: download the file
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  markBackedUp();
}

// 2b. Remember when you last made a backup
function markBackedUp() {
  trip.lastBackup = new Date().toISOString();
  saveTrip();
  showBackupStatus();
}

// 3. IMPORT step 1: open the file picker
function chooseImportFile() {
  importFile.click();
}

// 4. IMPORT step 2: read the chosen file and load the trip
async function importTrip() {
  const chosen = importFile.files[0];
  if (!chosen) return;

  try {
    const text = await chosen.text();
    const newTrip = JSON.parse(text);

    // Check it really is one of our trips
    if (!newTrip.name || !Array.isArray(newTrip.days)) {
      alert("That file doesn't look like a trip backup.");
      return;
    }

    // Never replace a trip without asking
    if (trip && !confirm(`Replace "${trip.name}" on this device with "${newTrip.name}" from the file?`)) {
      return;
    }

    trip = newTrip;
    saveTrip();
    showTrip();
    alert(`✅ Imported "${trip.name}".`);
  } catch (error) {
    alert("Couldn't read that file. Is it a trip backup (.json)?");
  } finally {
    importFile.value = ""; // so you can pick the same file again later
  }
}

// 5. Run importTrip whenever a file is chosen
importFile.addEventListener("change", importTrip);
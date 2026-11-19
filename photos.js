// photos.js — photos for Don't Forget items

const photoInput = document.getElementById("photo-input");
const photoViewer = document.getElementById("photo-viewer");
const photoViewerImage = document.getElementById("photo-viewer-image");
let photoItemIndex = null; // which item is getting a photo

// 1. "📷 Add photo": remember which item, then open the photo picker
function choosePhoto(i) {
  photoItemIndex = i;
  photoInput.click();
}

// 2. Shrink a photo so lots of them fit in the app's small storage
async function shrinkPhoto(file) {
  const picture = new Image();
  picture.src = URL.createObjectURL(file);
  await picture.decode(); // wait until the photo has loaded

  const biggest = 500; // longest side, in pixels
  const scale = Math.min(1, biggest / Math.max(picture.width, picture.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(picture.width * scale);
  canvas.height = Math.round(picture.height * scale);
  canvas.getContext("2d").drawImage(picture, 0, 0, canvas.width, canvas.height);

  URL.revokeObjectURL(picture.src);
  return canvas.toDataURL("image/jpeg", 0.7); // 0.7 = 70% quality, much smaller
}

// 3. Shrink a photo and save it on item number i
async function savePhoto(i, file) {
  const item = getWishlist()[i];
  const oldPhoto = item.photo;
  try {
    item.photo = await shrinkPhoto(file);
    saveTrip();
  } catch (error) {
    item.photo = oldPhoto; // put things back the way they were
    if (error.name === "QuotaExceededError") {
      alert("The app's storage is full, so the photo wasn't saved. Try removing a few other photos.");
    } else {
      alert("Couldn't add that photo. Try a different one?");
    }
  }
  showWishlist();
}

// 4. When a photo is chosen in the picker, save it
photoInput.addEventListener("change", function () {
  const file = photoInput.files[0];
  photoInput.value = ""; // so the same photo can be picked again later
  if (file && photoItemIndex !== null) {
    savePhoto(photoItemIndex, file);
  }
});

// 5. "📋 Paste photo": use a picture you copied (from a website, Photos, a message…)
async function pastePhoto(i) {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const clipboardItem of clipboardItems) {
      const imageType = clipboardItem.types.find((type) => type.startsWith("image/"));
      if (imageType) {
        const picture = await clipboardItem.getType(imageType);
        await savePhoto(i, picture);
        return;
      }
    }
    alert("There's no picture copied yet. Long-press a photo, tap Copy, then try again.");
  } catch (error) {
    alert("Couldn't paste. Long-press a photo, tap Copy, then tap 📋 Paste photo again.");
  }
}

// 6. Remove a photo (always ask first)
function removePhoto(i) {
  if (!confirm("Remove this photo?")) {
    return;
  }
  delete getWishlist()[i].photo;
  saveTrip();
  showWishlist();
}

// 7. Tap a photo to see it big; tap again to close
function viewPhoto(i) {
  photoViewerImage.src = getWishlist()[i].photo;
  photoViewer.hidden = false;
}
photoViewer.addEventListener("click", function () {
  photoViewer.hidden = true;
});
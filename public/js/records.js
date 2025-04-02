function openForm() {
  document.getElementById("popup-form").style.display = "flex";
}

function closeForm() {
  document.getElementById("popup-form").style.display = "none";
}

document
  .getElementById("popup-form")
  .addEventListener("click", function (event) {
    if (event.target === this) {
      closeForm();
    }
  });

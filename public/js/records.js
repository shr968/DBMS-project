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
//edit
// Function to open the edit form with existing record data
function openEditForm(record_id, date, hospital_name, description, drive_link) {
  document.getElementById("edit_record_id").value = record_id;
  document.getElementById("edit_drive_link").value = drive_link;
  document.getElementById("edit_date").value = date;
  document.getElementById("edit_hospital_name").value = hospital_name;
  document.getElementById("edit_description").value = description || "";

  document.getElementById("edit-popup-form").style.display = "flex"; // Show the popup
}

function closeEditForm() {
  document.getElementById("edit-popup-form").style.display = "none"; // Hide the popup
}


// Handle the edit form submission
document.getElementById("edit-form").addEventListener("submit", async function (event) {
  event.preventDefault(); 

  const record_id = document.getElementById("edit_record_id").value;
  const drive_link = document.getElementById("edit_drive_link").value;
  const date = document.getElementById("edit_date").value;
  const hospital_name = document.getElementById("edit_hospital_name").value;
  const description = document.getElementById("edit_description").value;

  const response = await fetch("/update-record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",  // Specify JSON format
    },
    body: JSON.stringify({ record_id, drive_link, date, hospital_name, description }), // Convert form data to JSON
  });

  const result = await response.json();
  if (result.success) {
    alert("Record updated successfully!");
    location.reload();
  } else {
    alert("Error updating record!");
  }
});




// Function to delete a record
function deleteRecord(patient_id, record_id) {
  if (confirm("Are you sure you want to delete this record?")) {
    fetch(`/delete-record/${patient_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ record_id }), // Send record_id in request body
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Record deleted successfully!");
          location.reload(); // Refresh page after deletion
        } else {
          alert("Failed to delete record.");
        }
      })
      .catch((error) => console.error("Error:", error));
  }
}


  
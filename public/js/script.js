let menu = document.querySelector("#menu-btn");
let navbar = document.querySelector(".header .nav");
let header = document.querySelector(".header");

menu.onclick = () => {
  menu.classList.toggle("fa-times");
  navbar.classList.toggle("active");
};

window.onscroll = () => {
  menu.classList.remove("fa-times");
  navbar.classList.remove("active");

  if (window.scrollY > 0) {
    header.classList.add("active");
  } else {
    header.classList.remove("active");
  }
};

// popup section
function openPopup(event) {
  event.preventDefault();
  document.getElementById("popupOverlay").style.display = "flex";
  document.getElementById("content").classList.add("blurred");
}

function closePopup(event) {
  document.getElementById("popupOverlay").style.display = "none";
  document.getElementById("content").classList.remove("blurred");
}

// patient login section
function openPatientLogin(event) {
  event.preventDefault();
  document.getElementById("patientLoginPopup").style.display = "flex";
  document.getElementById("popupOverlay").style.display = "none";
}

function closePatientLogin(event) {
  document.getElementById("patientLoginPopup").style.display = "none";
}

// doctor login section
function openDoctorLogin(event) {
  event.preventDefault();
  document.getElementById("doctorLoginPopup").style.display = "flex";
  document.getElementById("popupOverlay").style.display = "none";
}

function closeDoctorLogin(event) {
  document.getElementById("doctorLoginPopup").style.display = "none";
}

// hospital login section
function openHospitalLogin(event) {
  event.preventDefault();
  document.getElementById("hospitalLoginPopup").style.display = "flex";
  document.getElementById("popupOverlay").style.display = "none";
}

function closeHospitalLogin(event) {
  document.getElementById("hospitalLoginPopup").style.display = "none";
}

// Patient Registration Section
function openPatientRegister(event) {
  event.preventDefault();
  document.getElementById("patientRegisterPopup").style.display = "flex";
}

function closePatientRegister(event) {
  event.preventDefault();
  document.getElementById("patientRegisterPopup").style.display = "none";
}

// Doctor Registration Section
function openDoctorRegister(event) {
  event.preventDefault();
  document.getElementById("doctorRegisterPopup").style.display = "flex";
}

function closeDoctorRegister(event) {
  event.preventDefault();
  document.getElementById("doctorRegisterPopup").style.display = "none";
}

// Hospital Registration Section
function openHospitalRegister(event) {
  event.preventDefault();
  document.getElementById("hospitalRegisterPopup").style.display = "flex";
}

function closeHospitalRegister(event) {
  event.preventDefault();
  document.getElementById("hospitalRegisterPopup").style.display = "none";
}

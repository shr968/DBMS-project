const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const app = express();
require('dotenv').config();
console.log("Using DB credentials:");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connected to Clever Cloud MySQL!');
  }
});

function authenticatePatientOrDoctor(req, res, next) {
  if (
    req.session.patient_id ||
    req.session.doctor_id ||
    req.session.hospital_id
  ) {
    return next();
  }
  res.redirect("/patient-login");
}


//starts
app.get("/", (req, res) => {
  res.render("mainpage", {
    showLoginPopup: false,
    showDoctorLoginPopup: false,
    doctor_id: null,
    hospital_id: null,
    patient_id: null,
  });
});
app.get("/dashboard", (req, res) => {
  res.render("dashboard");
});


app.get("/doctor-login", (req, res) => {
  res.render("doctor-login");
});

const createProcedure = `
CREATE PROCEDURE doctor_login_proc (
  IN p_doctor_id INT,
  IN p_name VARCHAR(255)
)
BEGIN
  SELECT * FROM doctors
  WHERE doctor_id = p_doctor_id
    AND CONCAT(first_name, ' ', last_name) = p_name;
END
`;

db.query(createProcedure, (err, results) => {
  if (err) {
    console.error("Error creating stored procedure:", err);
  } else {
    console.log("Stored procedure created successfully.");
  }
});



app.post("/doctor-login", (req, res) => {
  const { doctor_id, name } = req.body;

  const sql = `CALL doctor_login_proc(?, ?)`;
  db.query(sql, [doctor_id, name], (err, results) => {
    if (err) {
      console.error("Login error:", err);
      return res.send("Error logging in.");
    }
    const doctorData = results[0];
    if (doctorData.length > 0) {
      req.session.doctor_id = doctor_id;
      res.redirect(`/doctor-dashboard/${doctor_id}`);
    } else {
      res.send("Invalid credentials.");
    }
  });
});




app.get("/doctor-register", (req, res) => {
  res.render("doctor-register");
});

app.post("/doctor-register", (req, res) => {
  const { first_name, mid_name, last_name, speciality, hospital_id } = req.body;

  const findDoctorSql = `
    SELECT doctor_id FROM doctors 
    WHERE first_name = ? AND mid_name = ? AND last_name = ? AND speciality = ?`;

  db.query(
    findDoctorSql,
    [first_name, mid_name, last_name, speciality],
    (err, results) => {
      if (err) {
        console.error("Error checking for existing doctor:", err);
        return res.send("Error during registration.");
      }

      let doctor_id;

      if (results.length > 0) {
        doctor_id = results[0].doctor_id;
      } else {
        const doctorSql = `INSERT INTO doctors (first_name, mid_name, last_name, speciality) VALUES (?, ?, ?, ?)`;

        return db.query(
          doctorSql,
          [first_name, mid_name, last_name, speciality],
          (err, result) => {
            if (err) {
              console.error("Error registering doctor:", err);
              return res.send("Error during registration.");
            }

            doctor_id = result.insertId;

            // Link doctor to hospital
            linkDoctorToHospital(doctor_id, hospital_id, res);
          }
        );
      }

      // If doctor already exists, insert into doctor_hospital
      linkDoctorToHospital(doctor_id, hospital_id, res);
    }
  );
});

function linkDoctorToHospital(doctor_id, hospital_id, res) {
  const doctorHospitalSql = `INSERT INTO works_in (doctor_id, hospital_id) VALUES (?, ?)`;

  db.query(doctorHospitalSql, [doctor_id, hospital_id], (err) => {
    if (err) {
      console.error("Error linking doctor to hospital:", err);
      return res.send("Doctor registered, but hospital link failed.");
    }
    res.render("mainpage", {
      showLoginPopup: false,
      showDoctorLoginPopup: true,
      doctor_id: doctor_id,
      hospital_id: null,
      patient_id: null, // Send the doctor_id to the view
    });
  });
}

// Function to link doctor to hospital
function linkDoctorToHospital(doctor_id, hospital_id, res) {
  const doctorHospitalSql = `INSERT INTO works_in (doctor_id, hospital_id) VALUES (?, ?)`;

  db.query(doctorHospitalSql, [doctor_id, hospital_id], (err) => {
    if (err) {
      console.error("Error linking doctor to hospital:", err);
      return res.send("Doctor registered, but hospital link failed.");
    }
    res.render("mainpage", {
      showLoginPopup: false,
      showDoctorLoginPopup: true,
      doctor_id: doctor_id,
      hospital_id: null,
      patient_id: null,
    });
  });
}

app.get("/doctor-dashboard/:doctor_id", async (req, res) => {
  const doctorId = req.session.doctor_id;

  if (!doctorId) {
    return res.status(401).send("Unauthorized: Please log in first.");
  }

  const queryHospitals = `
        SELECT DISTINCT h.hospital_id, h.name AS hospital_name
        FROM hospital h
        JOIN works_in dh ON h.hospital_id = dh.hospital_id
        WHERE dh.doctor_id = ?;
    `;

  const queryPatients = `
        SELECT p.patient_id, p.first_name, p.last_name, h.hospital_id, h.name AS hospital_name
        FROM patients p
        JOIN treatment t ON p.patient_id = t.patient_id
        JOIN works_in dh ON t.doctor_id = dh.doctor_id
        JOIN hospital h ON dh.hospital_id = h.hospital_id
        WHERE t.doctor_id = ?;
    `;

  try {
    const [hospitals] = await db.promise().query(queryHospitals, [doctorId]);
    const [patients] = await db.promise().query(queryPatients, [doctorId]);

    res.render("doctor-dashboard", {
      doctor_id: doctorId,
      hospitals,
      patients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get("/doctor-patient-records/:hospitalId", (req, res) => {
  const hospitalId = req.params.hospitalId;
  const doctorId = req.session.doctor_id; // Assuming doctor_id is stored in session

  if (!doctorId) {
    return res.redirect("/doctor-login"); // Ensure doctor is logged in
  }

  // Fetch patients treated by this doctor in this hospital
  const sql = `
    SELECT p.patient_id, p.first_name, p.last_name 
    FROM patients p
    JOIN treatment t ON p.patient_id = t.patient_id
    JOIN works_in dh ON t.doctor_id = dh.doctor_id
    WHERE t.doctor_id = ? AND dh.hospital_id = ?;
  `;

  db.query(sql, [doctorId, hospitalId], (err, patients) => {
    if (err) {
      console.error("Error fetching patients:", err);
      return res.status(500).send("Internal Server Error");
    }

    // Get hospital name
    db.query(
      "SELECT name FROM hospital WHERE hospital_id = ?",
      [hospitalId],
      (err, hospital) => {
        if (err) {
          console.error("Error fetching hospital:", err);
          return res.status(500).send("Internal Server Error");
        }

        res.render("doctor-patient-records", {
          hospital_name: hospital[0]?.name || "Unknown Hospital",
          patients,
        });
      }
    );
  });
});


//hospital routes
app.get("/hospital-register", (req, res) => {
  res.render("hospital-register");
});
app.post("/hospital-register", (req, res) => {
  const { name, contact, location } = req.body;

  const sql = `INSERT INTO hospital (name, contact, location) VALUES (?, ?, ?)`;
  db.query(sql, [name, contact, location], (err, result) => {
    if (err) {
      console.error("Error registering hospital:", err);
      return res.send("Error during registration.");
    }
    const hospital_id = result.insertId;
    res.render("mainpage", {
      showLoginPopup: true,
      showDoctorLoginPopup: false,
      hospital_id: hospital_id,
      doctor_id: null,
      patient_id: null, // Send the hospital_id to the view
    });
  });
});

app.get("/hospital-login", (req, res) => {
  res.render("hospital-login");
});

app.post("/hospital-login", (req, res) => {
  const { hospital_id, name } = req.body;

  const sql = `SELECT * FROM hospital WHERE hospital_id = ? AND name = ?`;
  db.query(sql, [hospital_id, name], (err, results) => {
    if (err) {
      console.error("Login error:", err);
      return res.send("Error logging in.");
    }
    if (results.length > 0) {
      req.session.hospital_id = hospital_id;
      res.redirect(`/hospital-dashboard/${hospital_id}`);
    } else {
      res.send("Invalid credentials.");
    }
  });
});
app.get("/hospital-dashboard/:hospital_id", (req, res) => {
  if (!req.session.hospital_id) {
    return res.redirect("/hospital-login");
  }

  const hospital_id = req.params.hospital_id;

  const treatmentSql = `
    SELECT 
        t.patient_id, 
        p.first_name AS first_name, 
        p.last_name AS last_name, 
        CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
    FROM treatment t
    JOIN patients p ON t.patient_id = p.patient_id
    JOIN doctors d ON t.doctor_id = d.doctor_id
    JOIN works_in dh ON d.doctor_id = dh.doctor_id
    WHERE dh.hospital_id = ?;
  `;

  const countSql = `
    SELECT COUNT(DISTINCT t.patient_id) AS total_patients
    FROM treatment t
    JOIN doctors d ON t.doctor_id = d.doctor_id
    JOIN works_in dh ON d.doctor_id = dh.doctor_id
    WHERE dh.hospital_id = ?;
  `;

  db.query(treatmentSql, [hospital_id], (err, treatmentResults) => {
    if (err) {
      console.error("Error fetching treatment data:", err);
      return res.send("Error loading hospital dashboard.");
    }

    db.query(countSql, [hospital_id], (err2, countResults) => {
      if (err2) {
        console.error("Error fetching patient count:", err2);
        return res.send("Error loading hospital dashboard.");
      }

      const total_patients = countResults[0].total_patients;
      res.render("hospital-dashboard", { hospital_id, treatments: treatmentResults, total_patients });
    });
  });
});



//patient routes
app.get("/patient-login", (req, res) => {
  res.render("patient-login");
});

app.get("/patient-register", (req, res) => {
  res.render("patient-register");
});

app.post("/patient-login", (req, res) => {
  const { patient_id, name } = req.body;
  const sql = `SELECT * FROM patients WHERE patient_id = ? AND first_name = ?`;

  db.query(sql, [patient_id, name], (err, results) => {
    if (err) {
      console.error("Login error:", err);
      res.send("Login failed.");
    } else if (results.length > 0) {
      req.session.patient_id = patient_id;
      res.redirect(`/patient-dashboard/${patient_id}`);
    } else {
      res.send("Invalid Patient ID or Name.");
    }
  });
});

// Function to generate a unique 5-digit patient ID
function generatePatientID() {
  return Math.floor(10000 + Math.random() * 90000); // Random 5-digit number
}

const createTriggerQuery = `
  CREATE TRIGGER validate_patient_insert BEFORE INSERT ON patients
  FOR EACH ROW
  BEGIN
    -- Validate Date of Birth
    IF NEW.dob > CURDATE() THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth cannot be in the future';
    END IF;
  END;
`;

db.query(createTriggerQuery, (err, result) => {
  if (err) {
    console.error("Error creating trigger:", err);
  } else {
    console.log("Trigger created successfully");
  }
});



app.post("/patient-register", (req, res) => {
  const { first_name, middle_name, last_name, dob, sex, blood_group } = req.body;
  const patient_id = generatePatientID();

  const sql = `INSERT INTO patients (patient_id, first_name, middle_name, last_name, dob, sex, blood_group)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

               db.query(sql, [patient_id, first_name, middle_name, last_name, dob, sex, blood_group], (err, result) => {
                if (err) {
                  if (err.code === '45000') {
                    // Handle the trigger error
                    res.send("Date of birth cannot be in the future.");
                  } else {
                    console.error("Registration error:", err);
                    res.send("Error registering patient.");
                  }
                } else {
                  res.render("mainpage", {
                    showLoginPopup: false,
                    showDoctorLoginPopup: true,
                    patient_id: patient_id,
                    doctor_id: null,
                    hospital_id: null,
                  });
                }
              });              
});



app.get(
  "/patient-dashboard/:patient_id",
  authenticatePatientOrDoctor,
  (req, res) => {
    const patient_id = req.params.patient_id;
    const sql = `SELECT * FROM patients WHERE patient_id = ?`;
    db.query(sql, [patient_id], (err, result) => {
      if (err) {
        console.error("Error fetching patient data:", err);
        return res.send("Error loading patient dashboard.");
      }

      if (result.length === 0) {
        return res.send("Patient not found.");
      }
      res.render("patient-dashboard", { patient_id, patient: result[0] });
    });
  }
);

app.get("/emergency-contacts", (req, res) => {
  res.render("emergency-contacts");
});

app.get("/emergency/:id", authenticatePatientOrDoctor, (req, res) => {
  const patient_id = req.params.id;

  // Check if the logged-in user has access to this patient's emergency contacts
  if (
    req.session.doctor_id ||
    req.session.hospital_id ||
    req.session.patient_id == patient_id
  ) {
    const sql = `SELECT * FROM emergency_contacts WHERE patient_id = ?`;

    db.query(sql, [patient_id], (err, results) => {
      if (err) {
        console.error("Error fetching contacts:", err);
        return res.status(500).send("Error loading emergency contacts.");
      }

      let contacts = [];
      if (results.length > 0) {
        const contactData = results[0];

        if (contactData.contact1_name && contactData.contact1_relation && contactData.contact1) {
          contacts.push({
            name: contactData.contact1_name,
            relation: contactData.contact1_relation,
            contact: contactData.contact1,
          });
        }

        if (contactData.contact2_name && contactData.contact2_relation && contactData.contact2) {
          contacts.push({
            name: contactData.contact2_name,
            relation: contactData.contact2_relation,
            contact: contactData.contact2,
          });
        }
      }

      res.render("emergency-contacts", { patient_id, contacts });
    });
  } else {
    return res.redirect("/patient-login");
  }
});
app.get("/hospital-register", (req, res) => {
  res.render("hospital-register");
});

app.post("/add-contact", (req, res) => {
  console.log("Received Data:", req.body); // Debugging: Check if data is received

  const patient_id = req.session.patient_id;
  const { contact1_name, contact1_relation, contact1, contact2_name, contact2_relation, contact2 } = req.body;

  if (!patient_id) {
    return res.status(401).json({ message: "Patient ID not found in session." });
  }

  const sql = `INSERT INTO emergency_contacts (patient_id, contact1, contact2, contact1_name, contact1_relation, contact2_name, contact2_relation) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [patient_id, contact1, contact2, contact1_name, contact1_relation, contact2_name, contact2_relation], (err, result) => {
    if (err) {
      console.error("Error saving contacts:", err);
      return res.status(500).json({ message: "Error saving contacts." });
    }

    res.json({
      message: "Contacts saved successfully!",
      contacts: [
        { name: contact1_name, relation: contact1_relation, contact: contact1 },
        { name: contact2_name, relation: contact2_relation, contact: contact2 },
      ].filter(contact => contact.name && contact.relation && contact.contact) // Remove empty contacts
    });
  });
});


app.get("/insurance/:id", authenticatePatientOrDoctor, (req, res) => {
  const patient_id = req.params.id;
  if (
    req.session.doctor_id ||
    req.session.hospital_id ||
    req.session.patient_id == patient_id
  ) {
    const sql = `SELECT * FROM insurance WHERE patient_id = ?`;
    db.query(sql, [patient_id], (err, results) => {
      if (err) {
        console.error("Error fetching insurance details:", err);
        res.send("Error loading insurance details.");
      } else {
        res.render("insurance", { patient_id, insurance: results });
      }
    });
  } else res.redirect("/patient-login");
});
app.post("/add-insurance/:id", (req, res) => {
  const patient_id = req.params.id;
  if (!req.session.patient_id || req.session.patient_id != patient_id) {
    return res.redirect("/patient-login");
  }

  const { name, coverage, expiry_date } = req.body;
  const sql = `INSERT INTO insurance (patient_id, name, coverage, expiry_date) 
                 VALUES (?, ?, ?, ?)`;

  db.query(sql, [patient_id, name, coverage, expiry_date], (err, result) => {
    if (err) {
      console.error("Error saving insurance:", err);
      res.send("Error saving insurance details.");
    } else {
      res.redirect(`/insurance/${patient_id}`);
    }
  });
});

app.get("/prescriptions/:id", authenticatePatientOrDoctor, (req, res) => {
  const patient_id = req.params.id;
  if (
    req.session.doctor_id ||
    req.session.hospital_id ||
    req.session.patient_id == patient_id
  ) {
    const sql = `SELECT * FROM pharma WHERE patient_id = ?`;
    db.query(sql, [patient_id], (err, results) => {
      if (err) {
        console.error("Error fetching prescriptions:", err);
        res.send("Error loading prescriptions.");
      } else {
        res.render("prescriptions", { patient_id, prescriptions: results });
      }
    });
  } else res.redirect("/patient-login");
});
app.post("/add-prescription/:id", (req, res) => {
  const patient_id = req.params.id;
  if (!req.session.patient_id || req.session.patient_id != patient_id) {
    return res.redirect("/patient-login");
  }

  const { drug_name, dosage, duration } = req.body;
  const sql = `INSERT INTO pharma (patient_id, drug_name, dosage, duration) 
                 VALUES (?, ?, ?, ?)`;

  db.query(sql, [patient_id, drug_name, dosage, duration], (err, result) => {
    if (err) {
      console.error("Error saving prescription:", err);
      res.send("Error saving prescription.");
    } else {
      res.redirect(`/prescriptions/${patient_id}`);
    }
  });
});
app.get("/records/:id", authenticatePatientOrDoctor, (req, res) => {
  const patient_id = req.params.id;
  if (
    req.session.doctor_id ||
    req.session.hospital_id ||
    req.session.patient_id == patient_id
  ) {
    const sql = `SELECT * FROM records WHERE patient_id = ?`;
    db.query(sql, [patient_id], (err, results) => {
      if (err) {
        console.error("Error fetching records:", err);
        res.send("Error loading records.");
      } else {
        res.render("records", { patient_id, records: results });
      }
    });
  } else res.redirect("/patient-login");
});
app.post("/add-record/:id", (req, res) => {
  const patient_id = req.params.id;
  if (!req.session.patient_id || req.session.patient_id != patient_id) {
    return res.redirect("/patient-login");
  }

  const { drive_link, date, hospital_name, description, doctor_id } = req.body;

  // Assuming doctor_id is passed and it's valid
  const sql = `INSERT INTO records (patient_id, drive_link, date, hospital_name, description, doctor_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(
    sql,
    [
      patient_id,
      drive_link,
      date,
      hospital_name,
      description || null,
      doctor_id,
    ],
    (err, result) => {
      if (err) {
        console.error("Error saving record:", err);
        res.send("Error saving medical record.");
      } else {
        res.redirect(`/records/${patient_id}`);
      }
    }
  );
});
app.post("/update-record", async (req, res) => {
  try {
    console.log("Received data:", req.body);  // Log request body

    const { record_id, drive_link, date, hospital_name, description } = req.body;

    if (!record_id || !drive_link || !date || !hospital_name) {
      console.log("Missing fields:", { record_id, drive_link, date, hospital_name });
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const sql = "UPDATE records SET drive_link = ?, date = ?, hospital_name = ?, description = ? WHERE record_id = ?";
    await db.execute(sql, [drive_link, date, hospital_name, description, record_id]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating record:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/delete-record/:patient_id", (req, res) => {
  const patient_id = req.params.patient_id; // Get patient_id from URL
  const { record_id } = req.body; // Get record_id from request body

  if (!record_id) {
    return res.json({ success: false, message: "Record ID is required." });
  }

  const sql = `DELETE FROM records WHERE patient_id = ? AND record_id = ?`;

  db.query(sql, [patient_id, record_id], (err, result) => {
    if (err) {
      console.error("Error deleting record:", err);
      return res.json({ success: false, message: "Error deleting record." });
    }
    res.json({ success: true });
  });
});


app.get("/treatment/:patient_id", authenticatePatientOrDoctor, (req, res) => {
  const patient_id = req.params.patient_id;

  if (
    req.session.doctor_id ||
    req.session.hospital_id ||
    req.session.patient_id == patient_id
  ) {
    const sql = `
      SELECT t.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, 
       dh.hospital_id, h.name AS hospital_name
FROM treatment t
JOIN doctors d ON t.doctor_id = d.doctor_id
JOIN works_in dh ON t.doctor_id = dh.doctor_id
JOIN hospital h ON dh.hospital_id = h.hospital_id
WHERE t.patient_id = ?;`

    db.query(sql, [patient_id], (err, results) => {
      if (err) {
        console.error("Error fetching treatment:", err);
        return res.send("Error fetching treatment data.");
      }
      res.render("treatment", { patient_id, treatments: results });
    });
  } else {
    res.redirect("/patient-login");
  }
});


app.post("/treatment/add", (req, res) => {
  const { doctor_id } = req.body;
  const patient_id = req.session.patient_id;

  if (!patient_id) {
    return res.redirect("/patient-login");
  }

  const sql = `INSERT INTO treatment (patient_id, doctor_id) VALUES (?, ?)`;
  
  db.query(sql, [patient_id, doctor_id], (err, result) => {
    if (err) {
      console.error("Error adding treatment:", err);
      return res.send("Error adding treatment.");
    }
    res.redirect(`/treatment/${patient_id}`);
  });
});


app.get("/view-hospitals", (req, res) => {
  const sql = "SELECT hospital_id, name, location, contact FROM hospital";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching hospitals:", err);
      return res.send("Error fetching hospitals.");
    }
    res.render("view-hospitals", { hospitals: results });
  });
});

app.get("/hospitals/:id/doctors", (req, res) => {
  const hospitalId = req.params.id;

  const query = `
      SELECT d.doctor_id, d.first_name, d.last_name, d.speciality, h.name as hospital_name
      FROM doctors d
      JOIN works_in dh ON d.doctor_id = dh.doctor_id
      JOIN hospital h ON dh.hospital_id = h.hospital_id
      WHERE h.hospital_id = ?;
  `;

  db.query(query, [hospitalId], (err, results) => {
    if (err) throw err;
    res.render("view-doctors", {
      doctors: results,
      hospitalName: results.length
        ? results[0].hospital_name
        : "Unknown Hospital",
    });
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

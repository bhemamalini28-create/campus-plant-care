import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import "./style.css";

const API = "https://campus-plant-care.onrender.com/api";

/* Plant images */
const plantImages = {
  Rose: "/images/rose.png",
  Neem: "/images/neem.png",
  Tulsi: "/images/tulsi.png",
  Coconut: "/images/coconut.png"
};

/* =========================
   LOGIN
========================= */

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@campus.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(API + "/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid login");
        return;
      }

      localStorage.setItem("token", data.token);
      onLogin();
    } catch (error) {
      setError("Unable to connect to server");
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={login}>
        <div className="login-icon">🌱</div>

        <h1>Campus Plant Care</h1>

        <p className="login-subtitle">
          Green Space Management System
        </p>

        <label>Email</label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
          required
        />

        <label>Password</label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />

        <button className="login-button">
          Login
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        <div className="demo-login">
          <strong>Demo Login</strong>
          <br />
          admin@campus.com / admin123
        </div>
      </form>
    </div>
  );
}

/* =========================
   MAIN APP
========================= */

function App() {
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const [plants, setPlants] = useState([]);
  const [editing, setEditing] = useState(null);

  /* Plant form */
  const [form, setForm] = useState({
    plantName: "",
    plantType: "",
    location: "",
    caretaker: "",
    wateringFrequency: "",
    condition: "Healthy",
    notes: "",
    image: "Rose"
  });

  /* Health check */
  const [healthPhoto, setHealthPhoto] = useState(null);

  const [healthPhotoPreview, setHealthPhotoPreview] =
    useState("");

  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState("");

  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);

  const [healthCondition, setHealthCondition] =
    useState("Healthy");

  const [observation, setObservation] = useState(
    "Upload a plant photo and check the plant condition."
  );

  /* =========================
     LOAD PLANTS
  ========================= */

  async function loadPlants() {
    try {
      const res = await fetch(API + "/plants", {
        headers: {
          Authorization:
            "Bearer " +
            localStorage.getItem("token")
        }
      });

      if (res.ok) {
        const data = await res.json();
        setPlants(data);
      }
    } catch (error) {
      console.error(
        "Unable to load plants:",
        error
      );
    }
  }

  useEffect(() => {
    if (loggedIn) {
      loadPlants();
    }
  }, [loggedIn]);

  /* =========================
     LOAD AI MODEL
  ========================= */

  async function loadAIModel() {
    try {
      setModelLoading(true);

      setPrediction(
        "Loading AI image recognition model..."
      );

      /*
        Make sure TensorFlow.js
        is ready before MobileNet.
      */
      await tf.ready();

      /*
        Use MobileNet V2.
        Alpha 1.0 gives the full model
        and better recognition accuracy.
      */
      const loadedModel = await mobilenet.load({
        version: 2,
        alpha: 1.0
      });

      setModel(loadedModel);
      setModelLoading(false);

      setPrediction("");

      console.log(
        "MobileNet AI model loaded successfully"
      );

      return loadedModel;

    } catch (error) {

      console.error(
        "AI model loading failed:",
        error
      );

      setModelLoading(false);

      setPrediction(
        "AI model could not be loaded."
      );

      setConfidence("");

      return null;
    }
  }

  /*
    Load the AI model after the application
    is displayed.

    This keeps the login and dashboard
    working normally while preparing
    the AI model in the background.
  */
  useEffect(() => {
    if (loggedIn && !model) {
      loadAIModel();
    }
  }, [loggedIn]);

  /* =========================
     FORM CHANGE
  ========================= */

  function change(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  /* =========================
     HEALTH CONDITION
  ========================= */

  function updateHealthCondition(e) {
    const condition = e.target.value;

    setHealthCondition(condition);

    if (condition === "Healthy") {
      setObservation(
        "Plant appears suitable for regular care. Continue scheduled watering and provide adequate sunlight."
      );
    }

    if (condition === "Needs Care") {
      setObservation(
        "Check soil moisture, sunlight and leaves. Adjust watering if required and monitor the plant regularly."
      );
    }

    if (condition === "Damaged") {
      setObservation(
        "Inspect the damaged parts and provide appropriate care. Monitor the plant regularly."
      );
    }
  }

  /* =========================
     HEALTH PHOTO + AI
  ========================= */

  async function handleHealthPhoto(e) {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    setHealthPhoto(file);

    const imageUrl = URL.createObjectURL(file);

    setHealthPhotoPreview(imageUrl);

    setPrediction("Preparing image...");
    setConfidence("");

    setObservation(
      "Photo uploaded successfully. AI is preparing to analyze the image."
    );

    try {
      /*
        Use the already loaded model.
        If it is not ready, load it here.
      */
      let currentModel = model;

      if (!currentModel) {
        currentModel = await loadAIModel();
      }

      if (!currentModel) {
        setPrediction(
          "AI recognition unavailable"
        );

        setConfidence("");

        setObservation(
          "The photo was uploaded, but the AI model could not be loaded. Please check your internet connection and try again."
        );

        URL.revokeObjectURL(imageUrl);

        return;
      }

      setPrediction("Analyzing image...");

      /*
        Create image object.
      */
      const image = new Image();

      image.onload = async () => {
        try {
          /*
            Make sure the image has valid dimensions.
          */
          if (
            image.naturalWidth === 0 ||
            image.naturalHeight === 0
          ) {
            throw new Error(
              "Invalid image dimensions"
            );
          }

          /*
            MobileNet classification.
          */
          const results =
            await currentModel.classify(
              image,
              5
            );

          if (
            results &&
            results.length > 0
          ) {
            /*
              Take the highest probability result.
            */
            const detected =
              results[0].className;

            const probability =
              results[0].probability;

            const score =
              (
                probability * 100
              ).toFixed(1);

            setPrediction(
              detected
            );

            setConfidence(
              score + "%"
            );

            setObservation(
              "AI detected: " +
                detected +
                ". Please visually check the leaves, soil and overall plant condition before deciding the health status."
            );

          } else {

            setPrediction(
              "No clear object detected"
            );

            setConfidence("");

            setObservation(
              "The AI could not clearly identify the object in the image. Please check the plant manually."
            );
          }

        } catch (error) {

          console.error(
            "Image recognition failed:",
            error
          );

          setPrediction(
            "Unable to analyze image"
          );

          setConfidence("");

          setObservation(
            "The photo was uploaded, but AI recognition failed. Please try another clear plant image."
          );
        }

        URL.revokeObjectURL(
          imageUrl
        );
      };

      image.onerror = () => {

        setPrediction(
          "Unable to load image"
        );

        setConfidence("");

        setObservation(
          "The selected image could not be loaded. Please try another image."
        );

        URL.revokeObjectURL(
          imageUrl
        );
      };

      /*
        Start loading the selected image.
      */
      image.src = imageUrl;

    } catch (error) {

      console.error(
        "AI recognition error:",
        error
      );

      setPrediction(
        "AI recognition failed"
      );

      setConfidence("");

      setObservation(
        "The image was uploaded, but the AI model could not analyze it."
      );

      URL.revokeObjectURL(
        imageUrl
      );
    }
  }

  /* =========================
     SAVE PLANT
  ========================= */

  async function save(e) {
    e.preventDefault();

    const method = editing
      ? "PUT"
      : "POST";

    const url = editing
      ? API + "/plants/" + editing
      : API + "/plants";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            "Bearer " +
            localStorage.getItem("token")
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        alert(
          "Unable to save plant record."
        );
        return;
      }

      alert(
        editing
          ? "Plant record updated successfully."
          : "Plant added successfully."
      );

      reset();
      loadPlants();

    } catch (error) {

      console.error(
        "Unable to save plant:",
        error
      );

      alert(
        "Unable to connect to server."
      );
    }
  }

  /* =========================
     EDIT PLANT
  ========================= */

  function editPlant(p) {
    setEditing(p._id);

    setForm({
      plantName: p.plantName || "",
      plantType: p.plantType || "",
      location: p.location || "",
      caretaker: p.caretaker || "",
      wateringFrequency:
        p.wateringFrequency || "",
      condition:
        p.condition || "Healthy",
      notes: p.notes || "",
      image:
        p.image ||
        p.plantName ||
        "Rose"
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* =========================
     DELETE
  ========================= */

  async function remove(id) {
    if (
      !window.confirm(
        "Delete this plant record?"
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        API + "/plants/" + id,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Bearer " +
              localStorage.getItem("token")
          }
        }
      );

      if (res.ok) {
        loadPlants();
      } else {
        alert(
          "Unable to delete record."
        );
      }

    } catch (error) {

      console.error(
        "Unable to delete plant:",
        error
      );
    }
  }

  /* =========================
     RESET
  ========================= */

  function reset() {
    setEditing(null);

    setForm({
      plantName: "",
      plantType: "",
      location: "",
      caretaker: "",
      wateringFrequency: "",
      condition: "Healthy",
      notes: "",
      image: "Rose"
    });
  }

  /* =========================
     SAVE HEALTH CHECK
  ========================= */

  function saveHealthCheck() {
    if (!healthPhoto) {
      alert(
        "Please upload a plant photo first."
      );
      return;
    }

    alert(
      "Health check recorded successfully."
    );
  }

  /* =========================
     LOGOUT
  ========================= */

  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
  }

  /* =========================
     LOGIN PAGE
  ========================= */

  if (!loggedIn) {
    return (
      <Login
        onLogin={() =>
          setLoggedIn(true)
        }
      />
    );
  }

  /* =========================
     STATISTICS
  ========================= */

  const healthy =
    plants.filter(
      (p) =>
        p.condition === "Healthy"
    ).length;

  const needsCare =
    plants.filter(
      (p) =>
        p.condition ===
        "Needs Care"
    ).length;

  const damaged =
    plants.filter(
      (p) =>
        p.condition === "Damaged"
    ).length;

  /* =========================
     MAIN PAGE
  ========================= */

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            🌱
          </div>

          <div>
            <h1>
              Campus Plant Care
            </h1>

            <p>
              Green Space Management System
            </p>
          </div>

        </div>

        <button
          className="logout"
          onClick={logout}
        >
          Logout
        </button>

      </header>

      {/* STATISTICS */}

      <section className="stats">

        <div className="stat-card">
          <div className="stat-icon">
            🌿
          </div>

          <div>
            <b>{plants.length}</b>
            <span>Total Plants</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            💚
          </div>

          <div>
            <b>{healthy}</b>
            <span>Healthy</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            💧
          </div>

          <div>
            <b>{needsCare}</b>
            <span>Needs Care</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            ⚠️
          </div>

          <div>
            <b>{damaged}</b>
            <span>Damaged</span>
          </div>
        </div>

      </section>

      {/* =========================
          HEALTH CHECK
      ========================== */}

      <section className="health-check">

        <div className="section-title">

          <div>
            <h2>
              🌿 Plant Health Check
            </h2>

            <p>
              Upload a real plant photo
              for image recognition and
              record your observation.
            </p>
          </div>

          <span className="feature-badge">
            AI Assisted
          </span>

        </div>

        <div className="health-content">

          <div className="upload-area">

            <label className="upload-box">

              <span className="upload-icon">
                📷
              </span>

              <strong>
                Upload Plant Photo
              </strong>

              <small>
                JPG, PNG or JPEG
              </small>

              <input
                type="file"
                accept="image/*"
                onChange={
                  handleHealthPhoto
                }
              />

            </label>

            {modelLoading && (
              <p className="model-status">
                Loading AI image
                recognition model...
              </p>
            )}

            {!modelLoading && model && (
              <p className="model-status">
                ✓ AI image recognition ready
              </p>
            )}

          </div>

          {healthPhotoPreview && (

            <div className="preview-area">

              <img
                src={
                  healthPhotoPreview
                }
                alt="Plant preview"
                className="health-preview"
              />

              <p className="preview-name">
                {healthPhoto?.name}
              </p>

            </div>

          )}

        </div>

        {/* AI RESULT */}

        {prediction && (

          <div className="ai-result">

            <h3>
              AI Image Recognition Result
            </h3>

            <div className="ai-details">

              <div>
                <span>
                  Detected
                </span>

                <strong>
                  {prediction}
                </strong>
              </div>

              <div>
                <span>
                  Confidence
                </span>

                <strong>
                  {confidence ||
                    "Not available"}
                </strong>
              </div>

            </div>

            <small className="ai-note">
              AI recognition identifies
              objects in the image. It
              does not diagnose plant
              diseases.
            </small>

          </div>

        )}

        {/* CONDITION */}

        <div className="health-form">

          <div className="form-field">

            <label>
              Plant Condition
            </label>

            <select
              value={healthCondition}
              onChange={
                updateHealthCondition
              }
            >
              <option>
                Healthy
              </option>

              <option>
                Needs Care
              </option>

              <option>
                Damaged
              </option>

            </select>

          </div>

          <div className="form-field">

            <label>
              Observation /
              Recommendation
            </label>

            <textarea
              value={observation}
              onChange={(e) =>
                setObservation(
                  e.target.value
                )
              }
              rows="4"
              placeholder="Enter observation or recommendation"
            />

          </div>

        </div>

        <button
          type="button"
          className="health-save"
          onClick={
            saveHealthCheck
          }
        >
          Save Health Check
        </button>

      </section>

      {/* =========================
          MAIN CONTENT
      ========================== */}

      <main className="main-grid">

        {/* ADD PLANT */}

        <section className="plant-form">

          <div className="section-heading">

            <h2>
              {editing
                ? "✏️ Update Plant"
                : "🌱 Add Plant Care Record"}
            </h2>

            <p>
              Maintain campus plant
              information and care details.
            </p>

          </div>

          <form onSubmit={save}>

            <label>
              Plant Name
            </label>

            <input
              name="plantName"
              value={
                form.plantName
              }
              onChange={change}
              placeholder="Example: Coconut"
              required
            />

            <label>
              Plant Type
            </label>

            <input
              name="plantType"
              value={
                form.plantType
              }
              onChange={change}
              placeholder="Example: Tree"
              required
            />

            <label>
              Campus Location
            </label>

            <input
              name="location"
              value={
                form.location
              }
              onChange={change}
              placeholder="Example: Main Gate"
              required
            />

            <label>
              Caretaker
            </label>

            <input
              name="caretaker"
              value={
                form.caretaker
              }
              onChange={change}
              placeholder="Caretaker name"
            />

            <label>
              Watering Frequency
            </label>

            <input
              name="wateringFrequency"
              value={
                form.wateringFrequency
              }
              onChange={change}
              placeholder="Example: Twice a week"
            />

            <label>
              Condition
            </label>

            <select
              name="condition"
              value={
                form.condition
              }
              onChange={change}
            >
              <option>
                Healthy
              </option>

              <option>
                Needs Care
              </option>

              <option>
                Damaged
              </option>
            </select>

            <label>
              Plant Image
            </label>

            <select
              name="image"
              value={
                form.image
              }
              onChange={change}
            >
              <option value="Rose">
                Rose
              </option>

              <option value="Neem">
                Neem
              </option>

              <option value="Tulsi">
                Tulsi
              </option>

              <option value="Coconut">
                Coconut
              </option>

            </select>

            <label>
              Notes
            </label>

            <input
              name="notes"
              value={
                form.notes
              }
              onChange={change}
              placeholder="Additional notes"
            />

            <div className="form-buttons">

              <button
                type="submit"
                className="primary-button"
              >
                {editing
                  ? "Update Record"
                  : "Add Plant"}
              </button>

              {editing && (

                <button
                  type="button"
                  className="cancel-button"
                  onClick={reset}
                >
                  Cancel
                </button>

              )}

            </div>

          </form>

        </section>

        {/* GREEN SPACE MONITORING */}

        <section className="monitoring">

          <div className="section-heading">

            <h2>
              🌳 Green Space Monitoring
            </h2>

            <p>
              Monitor plant condition
              and campus locations.
            </p>

          </div>

          <div className="monitoring-box">

            <div className="monitor-item">
              <span>Campus Plants</span>

              <strong>
                {plants.length}
              </strong>
            </div>

            <div className="monitor-item">
              <span>Healthy Plants</span>

              <strong className="healthy-text">
                {healthy}
              </strong>
            </div>

            <div className="monitor-item">
              <span>Needs Care</span>

              <strong className="care-text">
                {needsCare}
              </strong>
            </div>

            <div className="monitor-item">
              <span>Damaged</span>

              <strong className="damaged-text">
                {damaged}
              </strong>
            </div>

          </div>

          <div className="location-list">

            <h3>
              Campus Locations
            </h3>

            {plants.length === 0 ? (

              <p className="empty">
                No plant locations yet.
              </p>

            ) : (

              [
                ...new Set(
                  plants.map(
                    (p) =>
                      p.location
                  )
                )
              ].map(
                (location) => (

                  <div
                    className="location-item"
                    key={location}
                  >

                    <span>
                      📍 {location}
                    </span>

                    <strong>
                      {
                        plants.filter(
                          (p) =>
                            p.location ===
                            location
                        ).length
                      } plants
                    </strong>

                  </div>

                )
              )

            )}

          </div>

        </section>

      </main>

      {/* =========================
          PLANT RECORDS
      ========================== */}

      <section className="records">

        <div className="records-header">

          <div>
            <h2>
              🌿 Plant Care Records
            </h2>

            <p>
              View and manage registered
              campus plants.
            </p>
          </div>

          <span className="record-count">
            {plants.length} Records
          </span>

        </div>

        {plants.length === 0 ? (

          <div className="empty-records">

            <div>
              🌱
            </div>

            <h3>
              No plant records yet
            </h3>

            <p>
              Add your first campus
              plant using the form above.
            </p>

          </div>

        ) : (

          <div className="plant-grid">

            {plants.map((p) => {

              const normalizedName =
                p.plantName
                  ?.charAt(0)
                  .toUpperCase() +
                p.plantName
                  ?.slice(1)
                  .toLowerCase();

              const image =
                plantImages[
                  normalizedName
                ] ||
                plantImages[p.image] ||
                plantImages.Rose;

              return (

                <article
                  className="plant-card"
                  key={p._id}
                >

                  <div className="plant-image-wrapper">

                    <img
                      src={image}
                      alt={p.plantName}
                      className="plant-image"
                    />

                    <span
                      className={
                        "condition-badge " +
                        (
                          p.condition ===
                          "Healthy"
                            ? "healthy"
                            : p.condition ===
                              "Damaged"
                            ? "damaged"
                            : "care"
                        )
                      }
                    >
                      {p.condition}
                    </span>

                  </div>

                  <div className="plant-info">

                    <h3>
                      {p.plantName}
                    </h3>

                    <p className="plant-type">
                      {p.plantType}
                    </p>

                    <div className="info-row">

                      <span>
                        📍 Location
                      </span>

                      <strong>
                        {p.location}
                      </strong>

                    </div>

                    <div className="info-row">

                      <span>
                        👤 Caretaker
                      </span>

                      <strong>
                        {p.caretaker ||
                          "Not assigned"}
                      </strong>

                    </div>

                    <div className="info-row">

                      <span>
                        💧 Watering
                      </span>

                      <strong>
                        {p.wateringFrequency ||
                          "Not set"}
                      </strong>

                    </div>

                    {p.notes && (

                      <div className="notes">

                        <strong>
                          Note:
                        </strong>{" "}
                        {p.notes}

                      </div>

                    )}

                    <div className="card-buttons">

                      <button
                        className="edit-button"
                        onClick={() =>
                          editPlant(p)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="delete-button"
                        onClick={() =>
                          remove(p._id)
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </article>

              );

            })}

          </div>

        )}

      </section>

      {/* FOOTER */}

      <footer>

        <p>
          Campus Plant Care & Green Space
          Management System
        </p>

        <span>
          MERN Stack Application
        </span>

      </footer>

    </div>
  );
}

/* =========================
   START REACT
========================= */

createRoot(
  document.getElementById("root")
).render(
  <App />
);

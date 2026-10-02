const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
});
const plantSchema = new mongoose.Schema({
  plantName: String,
  plantType: String,
  location: String,
  caretaker: String,
  wateringFrequency: String,
  condition: String,
  notes: String,
  image: {
    type: String,
    default: "Rose"
  }
}, { timestamps: true });


const User = mongoose.model("User", userSchema);
const Plant = mongoose.model("Plant", plantSchema);

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired login" });
  }
}

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ id: user._id, email: user.email },
    process.env.JWT_SECRET, { expiresIn: "2h" });

  res.json({ token, email: user.email });
});

app.get("/api/plants", auth, async (req, res) => {
  const plants = await Plant.find().sort({ createdAt: -1 });
  res.json(plants);
});

app.post("/api/plants", auth, async (req, res) => {
  const plant = await Plant.create(req.body);
  res.status(201).json(plant);
});

app.put("/api/plants/:id", auth, async (req, res) => {
  const plant = await Plant.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plant) return res.status(404).json({ message: "Plant not found" });
  res.json(plant);
});

app.delete("/api/plants/:id", auth, async (req, res) => {
  const plant = await Plant.findByIdAndDelete(req.params.id);
  if (!plant) return res.status(404).json({ message: "Plant not found" });
  res.json({ message: "Plant deleted" });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const exists = await User.findOne({ email: "admin@campus.com" });
    if (!exists) {
      const password = await bcrypt.hash("admin123", 10);
      await User.create({ email: "admin@campus.com", password });
    }
    app.listen(process.env.PORT || 5000, () =>
      console.log("Server running on port " + (process.env.PORT || 5000))
    );
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
}

start();

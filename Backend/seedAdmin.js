// Backend/seedAdmin.js - Seed Demo Users in MongoDB
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_blind_assistant";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB for initial user seeding...");

    const demoUsers = [
      { username: "Priya S (Student)", email: "priya@gmail.com", phone: "9876543210", password: "priya123", role: "student", studentId: "STU-2025-084", course: "B.Sc Computer Science" },
      { username: "Prof. Rajesh (Teacher)", email: "teacher@gmail.com", phone: "9876543211", password: "teacher123", role: "teacher", subject: "Computer Science" },
      { username: "System Admin", email: "admin@gmail.com", phone: "9876543212", password: "AdminPassword123!", role: "admin" }
    ];

    for (const u of demoUsers) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create(u);
        console.log(`✅ ${u.role.toUpperCase()} account created: ${u.email}`);
      } else {
        console.log(`ℹ️ ${u.role.toUpperCase()} account already exists in MongoDB: ${u.email}`);
      }
    }

    console.log("MongoDB initial user seeding completed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error seeding users in MongoDB:", err);
    process.exit(1);
  });
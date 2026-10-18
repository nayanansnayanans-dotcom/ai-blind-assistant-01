// Backend/models/User.js - MongoDB User Schema for VisionAssist AI
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "9876543210",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin", "user"],
      default: "student",
    },
    studentId: {
      type: String,
      default: "",
    },
    course: {
      type: String,
      default: "Computer Science",
    },
    subject: {
      type: String,
      default: "Computer Science",
    },
    interestedSubject: {
      type: String,
      default: "Computer Science",
    }
  },
  { timestamps: true }
);

// Hash password automatically before saving if not hashed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Helper method to compare passwords during login
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  // If plain text comparison matches or bcrypt matches
  if (enteredPassword === this.password) return true;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
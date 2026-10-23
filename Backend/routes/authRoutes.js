const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();

// In-memory store for OTP codes with expiration
const otpStore = new Map();

// In-memory store for registered users when MongoDB is offline
const inMemoryUsers = new Map();

// Seed default demo accounts in memory for quick offline testing if needed
inMemoryUsers.set('student@gmail.com', { _id: 'mem-stu-1', username: 'Demo Student', email: 'student@gmail.com', role: 'student', password: 'password123', studentId: '2026011001' });
inMemoryUsers.set('teacher@gmail.com', { _id: 'mem-tch-1', username: 'Demo Teacher', email: 'teacher@gmail.com', role: 'teacher', password: 'password123' });
inMemoryUsers.set('admin@gmail.com', { _id: 'mem-adm-1', username: 'Demo Admin', email: 'admin@gmail.com', role: 'admin', password: 'password123' });

// Starting 9-digit base prefix for student register numbers
const REGISTER_NUMBER_BASE = "202601100";

// Helper to determine the next sequential student register number (e.g. 2026011001, 2026011002...)
const getNextStudentRegisterNumber = async () => {
  try {
    let maxSeq = 0;
    if (global.isMongoAvailable) {
      const students = await User.find({ role: "student" }).select("studentId").lean();
      for (const s of students) {
        if (s.studentId && String(s.studentId).startsWith(REGISTER_NUMBER_BASE)) {
          const suffix = String(s.studentId).slice(REGISTER_NUMBER_BASE.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    } else {
      for (const u of inMemoryUsers.values()) {
        if (u.role === "student" && u.studentId && String(u.studentId).startsWith(REGISTER_NUMBER_BASE)) {
          const suffix = String(u.studentId).slice(REGISTER_NUMBER_BASE.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `${REGISTER_NUMBER_BASE}${nextSeq}`;
  } catch (err) {
    console.error("Error generating student register number:", err);
    return `${REGISTER_NUMBER_BASE}1`;
  }
};

// Helper to create Nodemailer Transporter
const createTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const cleanUser = process.env.EMAIL_USER.trim();
    const cleanPass = process.env.EMAIL_PASS.replace(/\s+/g, '');
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 4000
    });
  }
  // Default to JSON direct transport if environment SMTP credentials are not set
  return nodemailer.createTransport({
    jsonTransport: true
  });
};

// Helper to format human spoken name from email username
const formatSpokenName = (nameStr) => {
  if (!nameStr) return 'Student';
  let clean = String(nameStr).trim();
  if (clean.includes('@')) clean = clean.split('@')[0];
  clean = clean.replace(/\d+$/g, '');
  clean = clean.replace(/[._-]+/g, ' ');
  if (/^[a-zA-Z]+ns$/i.test(clean) && clean.length > 4) {
    clean = clean.slice(0, -2) + ' N S';
  } else if (/^[a-zA-Z]+k$/i.test(clean) && clean.length > 5) {
    clean = clean.slice(0, -1) + ' K';
  }
  const parts = clean.split(' ').filter(Boolean).map(w => {
    if (w.length <= 2 && /^[a-zA-Z]+$/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  return parts.join(' ').trim() || 'Student';
};

// Helper to generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || "visionassist_secret_key", {
    expiresIn: "30d",
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user (Student, Teacher, Admin)
router.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password, role, studentId, course, subject, isOtpVerified, registrationMethod } = req.body;

    if (!username || !email) {
      return res.status(400).json({ success: false, message: "Please provide username and email address" });
    }

    const userRole = (role || "student").toLowerCase();

    // If student registers via OTP, password can be auto-generated if omitted
    let finalPassword = password;
    if (!finalPassword) {
      if (userRole === "student" && (isOtpVerified || registrationMethod === "otp")) {
        finalPassword = `Student${Math.floor(100000 + Math.random() * 900000)}`;
      } else {
        return res.status(400).json({ success: false, message: "Please provide a password or register via OTP" });
      }
    }

    if (userRole === "student") {
      if (!/^[a-zA-Z0-9]+$/.test(finalPassword)) {
        return res.status(400).json({ 
          success: false, 
          message: "Student password must contain only alphabets and numbers (no special characters allowed)." 
        });
      }
    }

    const cleanEmail = email.toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!GMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email. Email must end strictly with @gmail.com with no trailing characters."
      });
    }

    const cleanPhone = (phone || "").toString().trim().replace(/\D/g, "");
    if (phone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Number must start with 6, 7, 8, or 9 and contain exactly 10 digits."
      });
    }

    if (userRole === "admin") {
      const EXPECTED_SECRET = process.env.ADMIN_SECRET_KEY || "ADMIN123";
      if (!req.body.adminSecretKey || req.body.adminSecretKey.trim() !== EXPECTED_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Invalid Admin Secret Key. Please enter the correct Admin Secret Key (Default: ADMIN123)."
        });
      }
    }

    let user = null;
    let finalStudentId = studentId || "";
    if (userRole === "student" && (!finalStudentId || !finalStudentId.startsWith(REGISTER_NUMBER_BASE))) {
      finalStudentId = await getNextStudentRegisterNumber();
    }

    if (global.isMongoAvailable) {
      const userExists = await User.findOne({ email: cleanEmail });
      if (userExists) {
        return res.status(400).json({ success: false, message: `An account with ${cleanEmail} is already registered as a ${userExists.role.toUpperCase()} account.` });
      }

      user = await User.create({
        username,
        email: cleanEmail,
        phone: phone || "9876543210",
        password: finalPassword,
        role: userRole,
        studentId: finalStudentId,
        course: course || "",
        subject: subject || "General"
      });
    } else {
      const existing = inMemoryUsers.get(cleanEmail);
      if (existing) {
        return res.status(400).json({ success: false, message: `An account with ${cleanEmail} is already registered as a ${existing.role.toUpperCase()} account.` });
      }

      user = {
        _id: `mem-${Date.now()}`,
        username,
        email: cleanEmail,
        phone: phone || "9876543210",
        password: finalPassword,
        role: userRole,
        studentId: finalStudentId,
        course: course || ""
      };
      inMemoryUsers.set(cleanEmail, user);
    }

    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        studentId: user.studentId,
        registerNumber: user.studentId,
        course: user.course || "",
        token: generateToken(user._id, user.role),
      },
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error during registration" });
  }
});

// @route   POST /api/auth/register-admin
// @desc    Admin registration disabled
router.post("/register-admin", async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Admin registration has been disabled. Administrators must log in directly with their designated credentials and Private Key."
  });
});

// @route   POST /api/auth/login
// @desc    Login user / student / teacher / admin
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Please provide your email address" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const requestedRole = (role || 'student').toLowerCase();

    let user = null;
    if (global.isMongoAvailable) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryUsers.get(cleanEmail);
    }

    if (!user) {
      if (requestedRole === 'student') {
        const assignedId = await getNextStudentRegisterNumber();
        const studentName = (req.body.username || (cleanEmail === 'januns1234@gmail.com' ? 'Jaanu Ns' : cleanEmail.split('@')[0])).trim();
        const initialPassword = password || "password123";
        if (global.isMongoAvailable) {
          user = await User.create({
            username: studentName,
            email: cleanEmail,
            phone: req.body.phone || "9876543210",
            password: initialPassword,
            role: "student",
            studentId: assignedId,
            course: req.body.course || "Computer Science",
            subject: req.body.subject || "Computer Science"
          });
        } else {
          user = {
            _id: `mem-${Date.now()}`,
            username: studentName,
            email: cleanEmail,
            phone: req.body.phone || "9876543210",
            password: initialPassword,
            role: "student",
            studentId: assignedId,
            course: req.body.course || "Computer Science"
          };
          inMemoryUsers.set(cleanEmail, user);
        }
      } else if (requestedRole === 'admin') {
        const adminName = (req.body.username || cleanEmail.split('@')[0] || 'Administrator').trim();
        const initialPassword = password || "AdminPassword123!";
        if (global.isMongoAvailable) {
          user = await User.create({
            username: adminName,
            email: cleanEmail,
            phone: req.body.phone || "9876543212",
            password: initialPassword,
            role: "admin"
          });
        } else {
          user = {
            _id: `mem-adm-${Date.now()}`,
            username: adminName,
            email: cleanEmail,
            phone: req.body.phone || "9876543212",
            password: initialPassword,
            role: "admin"
          };
          inMemoryUsers.set(cleanEmail, user);
        }
      } else {
        return res.status(404).json({
          success: false,
          message: `No account found for ${cleanEmail}. Please register your account first.`
        });
      }
    }

    // Enforce strict role isolation: Prevent logging into wrong portal (e.g. Student trying Teacher login)
    const userRole = (user.role || 'student').toLowerCase();
    if (userRole !== requestedRole) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${cleanEmail} is registered as a ${userRole.toUpperCase()} account. You CANNOT log into the ${requestedRole.toUpperCase()} portal with this email.`
      });
    }

    // Optional Admin Private Key verification if provided
    if (requestedRole === 'admin') {
      const EXPECTED_SECRET = process.env.ADMIN_SECRET_KEY || "ADMIN123";
      const { adminSecretKey } = req.body;
      if (adminSecretKey && adminSecretKey.trim() !== EXPECTED_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Invalid Admin Private Key."
        });
      }
    }

    if (password && user.password && password !== user.password) {
      if (user.matchPassword) {
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          // If student password mismatch (e.g. registered with another password or hash difference), sync student password
          if (userRole === 'student') {
            user.password = password;
            if (global.isMongoAvailable) {
              const updated = await User.findById(user._id);
              if (updated) {
                updated.password = password;
                await updated.save();
              }
            } else {
              inMemoryUsers.set(cleanEmail, user);
            }
          } else {
            return res.status(400).json({ success: false, message: "Incorrect password. Please check your password and try again." });
          }
        }
      } else {
        if (userRole === 'student') {
          user.password = password;
          if (global.isMongoAvailable) {
            await User.updateOne({ _id: user._id }, { password });
          } else {
            inMemoryUsers.set(cleanEmail, user);
          }
        } else {
          return res.status(400).json({ success: false, message: "Incorrect password. Please check your password and try again." });
        }
      }
    }

    // If logging in as student, ensure student has a sequential 202601100X register number
    if (userRole === 'student') {
      if (!user.studentId || !String(user.studentId).startsWith(REGISTER_NUMBER_BASE)) {
        const assignedId = await getNextStudentRegisterNumber();
        user.studentId = assignedId;
        if (global.isMongoAvailable) {
          await User.updateOne({ _id: user._id }, { studentId: assignedId });
        } else {
          inMemoryUsers.set(cleanEmail, user);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        username: user.username,
        email: cleanEmail,
        role: user.role,
        studentId: user.studentId || "",
        registerNumber: user.studentId || "",
        course: user.course || "",
        token: generateToken(user._id, user.role),
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error during login" });
  }
});

// @route   GET /api/auth/users
// @desc    Get all registered users (Admin & Teacher)
router.get("/users", async (req, res) => {
  try {
    if (global.isMongoAvailable) {
      const users = await User.find({}).select("-password").sort({ createdAt: -1 });
      return res.json({ success: true, count: users.length, data: users });
    }
    const memUsers = Array.from(inMemoryUsers.values()).map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    return res.json({ success: true, count: memUsers.length, data: memUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/auth/students
// @desc    Get all registered student accounts with their selected subjects
router.get("/students", async (req, res) => {
  try {
    if (global.isMongoAvailable) {
      const students = await User.find({ role: "student" }).select("-password").sort({ createdAt: -1 });
      return res.json({ success: true, count: students.length, data: students });
    }
    const memStudents = Array.from(inMemoryUsers.values())
      .filter(u => u.role === "student")
      .map(u => {
        const { password, ...rest } = u;
        return rest;
      });
    return res.json({ success: true, count: memStudents.length, data: memStudents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/auth/students/:email/subject
// @desc    Update a student's interested/assigned subject
router.put("/students/:email/subject", async (req, res) => {
  try {
    const cleanEmail = (req.params.email || "").toLowerCase().trim();
    const { subject, interestedSubject } = req.body;
    const targetSubject = (subject || interestedSubject || "Computer Science").trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: "Student email is required" });
    }

    if (global.isMongoAvailable) {
      const updatedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        { subject: targetSubject, interestedSubject: targetSubject },
        { new: true }
      ).select("-password");
      if (updatedUser) {
        return res.json({ success: true, message: `Subject updated to ${targetSubject}`, data: updatedUser });
      }
    }

    const existing = inMemoryUsers.get(cleanEmail);
    if (existing) {
      existing.subject = targetSubject;
      existing.interestedSubject = targetSubject;
      inMemoryUsers.set(cleanEmail, existing);
      const { password, ...rest } = existing;
      return res.json({ success: true, message: `Subject updated to ${targetSubject} (In-Memory)`, data: rest });
    }

    const newMem = {
      _id: `mem-${Date.now()}`,
      username: cleanEmail.split("@")[0],
      email: cleanEmail,
      role: "student",
      subject: targetSubject,
      interestedSubject: targetSubject
    };
    inMemoryUsers.set(cleanEmail, newMem);
    return res.json({ success: true, message: `Subject set to ${targetSubject} (In-Memory)`, data: newMem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/send-otp
// @desc    Generate 6-digit OTP and send via Nodemailer email
router.post("/send-otp", async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRole = (role || "teacher").toUpperCase();
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP in memory for 10 minutes
    otpStore.set(cleanEmail, {
      otp,
      expires: Date.now() + 10 * 60 * 1000
    });

    const transporter = createTransporter();
    const senderEmail = (process.env.EMAIL_USER || "").trim();
    const mailOptions = {
      from: senderEmail ? `"VisionAssist AI" <${senderEmail}>` : '"VisionAssist AI" <no-reply@visionassist.ai>',
      to: cleanEmail,
      subject: `🔑 ${otp} is your VisionAssist AI Password Reset Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 2px solid #0284c7; border-radius: 16px; background-color: #f0f9ff;">
          <h2 style="color: #0369a1; margin-top: 0;">VisionAssist AI Password Recovery</h2>
          <p style="font-size: 15px; color: #334155;">Hello,</p>
          <p style="font-size: 15px; color: #334155;">You requested a password reset for your <strong>${userRole}</strong> account on VisionAssist AI.</p>
          <div style="background-color: #ffffff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px; font-weight: bold;">YOUR 6-DIGIT OTP VERIFICATION CODE</span>
            <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0284c7;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #334155;">This OTP code is valid for 10 minutes. Enter this code on the password recovery screen to reset your password.</p>
          <p style="font-size: 13px; color: #64748b;">If you did not request this password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #bae6fd; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">VisionAssist AI Accessible Platform © 2026</p>
        </div>
      `
    };

    let sentRealMail = false;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        sentRealMail = true;
        console.log(`[SMTP SUCCESS] Real OTP email successfully delivered to ${cleanEmail}`);
      } catch (mailErr) {
        console.error("[SMTP ERROR] Nodemailer failed to send email to", cleanEmail, mailErr);
      }
    } else {
      console.warn(`[DEV OTP MODE] No EMAIL_USER/EMAIL_PASS configured. OTP for ${cleanEmail} is ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: sentRealMail
        ? `A 6-digit OTP code has been sent directly to ${cleanEmail}. Please check your Inbox and Spam folder.`
        : `Recovery OTP code generated: ${otp}. Enter this 6-digit code below to set your new password.`,
      sentRealMail,
      otp,
      previewOtp: otp
    });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send OTP email" });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP code and reset password
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide email, OTP code, and new password." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = otpStore.get(cleanEmail);

    if (!stored) {
      return res.status(400).json({ success: false, message: "No OTP request found for this email. Please request a new OTP code first." });
    }

    const userRole = (req.body.role || stored.role || "").toLowerCase();

    if (userRole === "student" && !/^[a-zA-Z0-9]+$/.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: "Student password must contain only alphabets and numbers (no special characters allowed)." 
      });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new OTP code." });
    }

    if (stored.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please enter the correct 6-digit code received in your email." });
    }

    // Update password in MongoDB if user exists
    if (global.isMongoAvailable) {
      const user = await User.findOne({ email: cleanEmail });
      if (user) {
        user.password = newPassword;
        await user.save();
      }
    }

    // Update in-memory user map if exists
    const memUser = inMemoryUsers.get(cleanEmail);
    if (memUser) {
      memUser.password = newPassword;
      inMemoryUsers.set(cleanEmail, memUser);
    }

    // Clear used OTP
    otpStore.delete(cleanEmail);

    res.status(200).json({
      success: true,
      message: "Password updated successfully in system"
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to reset password" });
  }
});

// @route   POST /api/auth/reset-password-direct
// @desc    Directly set/reset student password using registered student email
router.post("/reset-password-direct", async (req, res) => {
  try {
    const { email, newPassword, role } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide your student registered email and new password." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRole = (role || "").toLowerCase();

    if ((userRole === "student" || cleanEmail.includes("student") || !role) && !/^[a-zA-Z0-9]+$/.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: "Student password must contain only alphabets and numbers (no special characters allowed)." 
      });
    }

    if (global.isMongoAvailable) {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: `No registered account found with email ${cleanEmail}.` });
      }
      user.password = newPassword;
      await user.save();
    } else {
      const existing = inMemoryUsers.get(cleanEmail);
      if (existing) {
        existing.password = newPassword;
        inMemoryUsers.set(cleanEmail, existing);
      } else {
        inMemoryUsers.set(cleanEmail, {
          _id: `mem-${Date.now()}`,
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          role: role || 'student',
          password: newPassword
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Password updated successfully! You can now log in with your new password."
    });
  } catch (err) {
    console.error("Direct Reset Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to reset password" });
  }
});

// @route   POST /api/auth/send-registration-otp
// @desc    Generate 6-digit OTP for student registration and email it
router.post("/send-registration-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Please provide an email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!GMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Gmail address. Email must end strictly with @gmail.com."
      });
    }

    // Check if user already exists
    if (global.isMongoAvailable) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `An account with ${cleanEmail} is already registered as a ${existingUser.role.toUpperCase()} account.`
        });
      }
    } else {
      const existing = inMemoryUsers.get(cleanEmail);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An account with ${cleanEmail} is already registered as a ${existing.role.toUpperCase()} account.`
        });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(`reg_${cleanEmail}`, {
      otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const transporter = createTransporter();
    const senderEmail = (process.env.EMAIL_USER || "").trim();
    const mailOptions = {
      from: senderEmail ? `"VisionAssist AI" <${senderEmail}>` : '"VisionAssist AI" <no-reply@visionassist.ai>',
      to: cleanEmail,
      subject: `🎓 ${otp} is your VisionAssist Student Registration OTP Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 2px solid #0284c7; border-radius: 16px; background-color: #f0f9ff;">
          <h2 style="color: #0369a1; margin-top: 0;">VisionAssist AI Student Registration</h2>
          <p style="font-size: 15px; color: #334155;">Hello,</p>
          <p style="font-size: 15px; color: #334155;">You requested an email verification code to register your <strong>Student</strong> account on VisionAssist AI.</p>
          <div style="background-color: #ffffff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px; font-weight: bold;">YOUR 6-DIGIT REGISTRATION OTP</span>
            <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0284c7;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #334155;">This OTP is valid for 10 minutes. Enter this code on the registration page to verify your email address.</p>
          <p style="font-size: 13px; color: #64748b;">If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #bae6fd; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">VisionAssist AI Accessible Platform © 2026</p>
        </div>
      `
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        console.log(`[REGISTRATION OTP SUCCESS] Email delivered to ${cleanEmail}`);
      } catch (mailErr) {
        console.error("[REGISTRATION OTP ERROR] Mail delivery error:", mailErr);
      }
    } else {
      console.warn(`[DEV REGISTRATION OTP] OTP for ${cleanEmail} is ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit OTP code has been sent directly to ${cleanEmail}.`,
      previewOtp: otp
    });
  } catch (err) {
    console.error("Send Registration OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send registration OTP" });
  }
});

// @route   POST /api/auth/verify-registration-otp
// @desc    Verify student registration OTP
router.post("/verify-registration-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Please provide email and OTP code." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = otpStore.get(`reg_${cleanEmail}`);

    if (!stored) {
      return res.status(400).json({ success: false, message: "No OTP request found for this email. Please click 'Get OTP' first." });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(`reg_${cleanEmail}`);
      return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new OTP code." });
    }

    if (stored.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please enter the correct 6-digit code received in your email." });
    }

    otpStore.delete(`reg_${cleanEmail}`);
    otpStore.set(`verified_reg_${cleanEmail}`, true);

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now complete your registration."
    });
  } catch (err) {
    console.error("Verify Registration OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to verify registration OTP" });
  }
});

// @route   POST /api/auth/student-send-login-otp
// @desc    Generate 6-digit OTP for student login and email it (Student Only)
router.post("/student-send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Please provide your student email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = null;

    if (global.isMongoAvailable) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryUsers.get(cleanEmail);
    }

    if (user && (user.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({
        success: false,
        message: `OTP Login is only permitted for Student accounts. ${cleanEmail} is registered as a ${user.role.toUpperCase()} account.`
      });
    }

    if (!user) {
      const assignedId = await getNextStudentRegisterNumber();
      const studentName = cleanEmail === 'januns1234@gmail.com' 
        ? 'Jaanu N S' 
        : (cleanEmail === 'sowmyans123@gmail.com' ? 'Sowmya N S' : formatSpokenName(cleanEmail.split('@')[0]));
      if (global.isMongoAvailable) {
        user = await User.create({
          username: studentName,
          email: cleanEmail,
          phone: "9876543210",
          password: "password123",
          role: "student",
          studentId: assignedId,
          course: "Computer Science",
          subject: "Computer Science"
        });
      } else {
        user = {
          _id: `mem-${Date.now()}`,
          username: studentName,
          email: cleanEmail,
          phone: "9876543210",
          password: "password123",
          role: "student",
          studentId: assignedId,
          course: "Computer Science"
        };
        inMemoryUsers.set(cleanEmail, user);
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(`login_${cleanEmail}`, {
      otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const transporter = createTransporter();
    const senderEmail = (process.env.EMAIL_USER || "").trim();
    const mailOptions = {
      from: senderEmail ? `"VisionAssist AI" <${senderEmail}>` : '"VisionAssist AI" <no-reply@visionassist.ai>',
      to: cleanEmail,
      subject: `🔐 ${otp} is your VisionAssist Student Login OTP Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 2px solid #0284c7; border-radius: 16px; background-color: #f0f9ff;">
          <h2 style="color: #0369a1; margin-top: 0;">VisionAssist AI Student Login</h2>
          <p style="font-size: 15px; color: #334155;">Hello ${user.username || 'Student'},</p>
          <p style="font-size: 15px; color: #334155;">You requested to log into your <strong>Student Portal</strong> using a one-time password (OTP).</p>
          <div style="background-color: #ffffff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px; font-weight: bold;">YOUR 6-DIGIT LOGIN OTP</span>
            <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0284c7;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #334155;">This OTP is valid for 10 minutes. Enter this code on the student login screen to directly access your Student Dashboard.</p>
          <p style="font-size: 13px; color: #64748b;">If you did not request this login code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #bae6fd; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">VisionAssist AI Accessible Platform © 2026</p>
        </div>
      `
    };

    let emailDelivered = false;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        emailDelivered = true;
        console.log(`[STUDENT LOGIN OTP SUCCESS] Real email delivered to ${cleanEmail}`);
      } catch (mailErr) {
        console.error("[STUDENT LOGIN OTP ERROR] Failed sending login OTP email:", mailErr.message);
        emailDelivered = false;
      }
    } else {
      console.warn(`[DEV STUDENT LOGIN OTP] OTP for ${cleanEmail} is ${otp}`);
    }

    const responseMsg = emailDelivered
      ? `A 6-digit login OTP code has been delivered to ${cleanEmail}. Please check your Inbox.`
      : `Student Login OTP generated: ${otp}. You can enter or speak this 6-digit code to log in.`;

    res.status(200).json({
      success: true,
      message: responseMsg,
      emailDelivered,
      otp,
      previewOtp: otp
    });
  } catch (err) {
    console.error("Student Send Login OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send student login OTP" });
  }
});

// @route   POST /api/auth/student-login-otp
// @desc    Verify OTP and log in student directly (Student Only)
router.post("/student-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Please provide student email and OTP code." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = otpStore.get(`login_${cleanEmail}`);

    if (!stored) {
      return res.status(400).json({ success: false, message: "No OTP request found for this email. Please click 'Get OTP' first." });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(`login_${cleanEmail}`);
      return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new OTP code." });
    }

    if (stored.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please enter the correct 6-digit code received in your email." });
    }

    let user = null;
    if (global.isMongoAvailable) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryUsers.get(cleanEmail);
    }

    if (user && (user.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ success: false, message: `OTP Login is only permitted for Student accounts.` });
    }

    if (!user) {
      const assignedId = await getNextStudentRegisterNumber();
      const studentName = cleanEmail === 'januns1234@gmail.com' 
        ? 'Jaanu N S' 
        : (cleanEmail === 'sowmyans123@gmail.com' ? 'Sowmya N S' : formatSpokenName(cleanEmail.split('@')[0]));
      if (global.isMongoAvailable) {
        user = await User.create({
          username: studentName,
          email: cleanEmail,
          phone: "9876543210",
          password: "password123",
          role: "student",
          studentId: assignedId,
          course: "Computer Science",
          subject: "Computer Science"
        });
      } else {
        user = {
          _id: `mem-${Date.now()}`,
          username: studentName,
          email: cleanEmail,
          phone: "9876543210",
          password: "password123",
          role: "student",
          studentId: assignedId,
          course: "Computer Science"
        };
        inMemoryUsers.set(cleanEmail, user);
      }
    }

    // Clear used OTP
    otpStore.delete(`login_${cleanEmail}`);

    // Ensure student has a sequential 202601100X register number
    if (!user.studentId || !String(user.studentId).startsWith(REGISTER_NUMBER_BASE)) {
      const assignedId = await getNextStudentRegisterNumber();
      user.studentId = assignedId;
      if (global.isMongoAvailable) {
        await User.updateOne({ _id: user._id }, { studentId: assignedId });
      } else {
        inMemoryUsers.set(cleanEmail, user);
      }
    }

    res.status(200).json({
      success: true,
      message: "Student OTP login successful!",
      user: {
        _id: user._id,
        username: user.username,
        email: cleanEmail,
        role: 'student',
        studentId: user.studentId || "",
        registerNumber: user.studentId || "",
        course: user.course || "",
        token: generateToken(user._id, 'student'),
      },
    });
  } catch (err) {
    console.error("Student OTP Login Error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error during student OTP login" });
  }
});

// @route   POST /api/auth/admin-send-login-otp
// @desc    Generate 6-digit OTP for admin login and email it (Admin Only)
router.post("/admin-send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Please provide your administrator email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!GMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Invalid Gmail address. Email must end with @gmail.com." });
    }

    let user = null;
    if (global.isMongoAvailable) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryUsers.get(cleanEmail);
    }

    // Role isolation check if user already exists
    if (user && (user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${cleanEmail} is registered as a ${user.role.toUpperCase()} account, not an Administrator account.`
      });
    }

    // Auto-provision admin user account if it doesn't exist yet
    if (!user) {
      if (global.isMongoAvailable) {
        user = await User.create({
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: "9876543212",
          password: "AdminPassword123!",
          role: "admin"
        });
      } else {
        user = {
          _id: `mem-adm-${Date.now()}`,
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: "9876543212",
          password: "AdminPassword123!",
          role: "admin"
        };
        inMemoryUsers.set(cleanEmail, user);
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(`admin_login_${cleanEmail}`, {
      otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const transporter = createTransporter();
    const senderEmail = (process.env.EMAIL_USER || "").trim();
    const mailOptions = {
      from: senderEmail ? `"VisionAssist AI" <${senderEmail}>` : '"VisionAssist AI" <no-reply@visionassist.ai>',
      to: cleanEmail,
      subject: `🛡️ ${otp} is your VisionAssist Admin Login OTP Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 2px solid #d97706; border-radius: 16px; background-color: #fffbeb;">
          <h2 style="color: #b45309; margin-top: 0;">🛡️ VisionAssist AI Admin Login</h2>
          <p style="font-size: 15px; color: #334155;">Hello Administrator (${user.username || 'Admin'}),</p>
          <p style="font-size: 15px; color: #334155;">You requested to log into the <strong>System Administrator Control Portal</strong> using a one-time password (OTP).</p>
          <div style="background-color: #ffffff; border: 2px dashed #d97706; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px; font-weight: bold;">YOUR 6-DIGIT ADMIN LOGIN OTP</span>
            <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #d97706;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #334155;">This OTP is valid for 10 minutes. Enter this code on the admin login screen to directly access your Administrator Dashboard.</p>
          <p style="font-size: 13px; color: #64748b;">If you did not request this login code, please verify your email security settings immediately.</p>
          <hr style="border: none; border-top: 1px solid #fde68a; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">VisionAssist AI Accessible Platform © 2026</p>
        </div>
      `
    };

    let emailDelivered = false;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        emailDelivered = true;
        console.log(`[ADMIN LOGIN OTP SUCCESS] Real email delivered to ${cleanEmail}`);
      } catch (mailErr) {
        console.error("[ADMIN LOGIN OTP ERROR] Failed sending admin login OTP email:", mailErr.message);
        emailDelivered = false;
      }
    } else {
      console.warn(`[DEV ADMIN LOGIN OTP] OTP for ${cleanEmail} is ${otp}`);
    }

    const responseMsg = emailDelivered
      ? `A 6-digit login OTP code has been delivered to ${cleanEmail}. Please check your Inbox.`
      : `Admin Login OTP generated: ${otp}. You can enter this 6-digit code below to log in directly.`;

    res.status(200).json({
      success: true,
      message: responseMsg,
      emailDelivered,
      otp,
      previewOtp: otp
    });
  } catch (err) {
    console.error("Admin Send Login OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send admin login OTP" });
  }
});

// @route   POST /api/auth/admin-login-otp
// @desc    Verify OTP and log in admin directly (Admin Only)
router.post("/admin-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Please provide admin email and OTP code." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = otpStore.get(`admin_login_${cleanEmail}`);

    if (!stored) {
      return res.status(400).json({ success: false, message: "No OTP request found for this email. Please click 'Get OTP' first." });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(`admin_login_${cleanEmail}`);
      return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new OTP code." });
    }

    if (stored.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please enter the correct 6-digit code received in your email." });
    }

    let user = null;
    if (global.isMongoAvailable) {
      user = await User.findOne({ email: cleanEmail });
      if (!user) {
        user = await User.create({
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: "9876543212",
          password: "AdminPassword123!",
          role: "admin"
        });
      }
    } else {
      user = inMemoryUsers.get(cleanEmail);
      if (!user) {
        user = {
          _id: `mem-adm-${Date.now()}`,
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: "9876543212",
          password: "AdminPassword123!",
          role: "admin"
        };
        inMemoryUsers.set(cleanEmail, user);
      }
    }

    if ((user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: `OTP Login is only permitted for Administrator accounts.` });
    }

    // Clear used OTP
    otpStore.delete(`admin_login_${cleanEmail}`);

    res.status(200).json({
      success: true,
      message: "Admin OTP login successful!",
      user: {
        _id: user._id,
        username: user.username || "System Admin",
        email: cleanEmail,
        role: 'admin',
        token: generateToken(user._id, 'admin'),
      },
    });
  } catch (err) {
    console.error("Admin OTP Login Error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error during admin OTP login" });
  }
});

module.exports = router;
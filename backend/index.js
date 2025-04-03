const express = require("express");
const mongoose = require("mongoose");
const qr = require("qrcode");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ClerkExpressWithAuth } = require("@clerk/clerk-sdk-node");
const { getClientIp } = require("request-ip");
const crypto = require("crypto");
const os = require("os");
const { networkInterfaces } = os;
const dotenv = require("dotenv");
require("dotenv").config(); // Load env variables
const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const FacultySchema = new mongoose.Schema({ name: String, email: String, clerkId: String });
const ClassSchema = new mongoose.Schema({ name: String, facultyId: mongoose.Schema.Types.ObjectId });
const StudentSchema = new mongoose.Schema({ name: String, rollNo: String, classId: mongoose.Schema.Types.ObjectId });

const AttendanceSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  date: { type: String, required: true },
  qrCode: String,
  ipAddress: { type: String, required: true }, // IP when QR was created
});

const AttendanceLogSchema = new mongoose.Schema({
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  deviceId: { type: String, required: true }, // Unique device identifier
  ipAddress: { type: String, required: true }, // IP of the student at time of marking
  timestamp: { type: Date, default: Date.now }, // When the attendance was marked
});
const Faculty = mongoose.model("Faculty", FacultySchema);
const Class = mongoose.model("Class", ClassSchema);
const Student = mongoose.model("Student", StudentSchema);
const Attendance = mongoose.model("Attendance", AttendanceSchema);
const AttendanceLog = mongoose.model("AttendanceLog", AttendanceLogSchema);

app.post("/api/faculty", async (req, res) => {
  const { clerkId, name, email } = req.body;

  let faculty = await Faculty.findOne({ clerkId });
  if (faculty) return res.json({ message: "User already exists" });

  faculty = new Faculty({ clerkId, name, email });
  await faculty.save();

  res.json({ message: "User created successfully" });
});
app.get("/api/faculty/:clerkId", async (req, res) => {
  const { clerkId } = req.params;
  const faculty = await Faculty.findOne({ clerkId });

  if (!faculty) return res.status(404).json({ error: "Faculty not found" });

  res.json(faculty);
});

app.post("/api/create-class", async (req, res) => {
  const { name, facultyId } = req.body;
  const newClass = await Class.create({ name, facultyId });
  res.json(newClass);
});

app.get("/api/students/:classId", async (req, res) => {
  const { classId } = req.params;
  const students = await Student.find({ classId });
  res.json(students);
});

// Add a student to a class
app.post("/api/students", async (req, res) => {
  const { name, rollNo, classId } = req.body;
  const newStudent = await Student.create({ name, rollNo, classId });
  res.json(newStudent);
});

app.post("/create-attendance", async (req, res) => {
  const { classId, date } = req.body;

  try {
    // Get Server IP (WiFi network of the faculty)
    const nets = networkInterfaces();
    let ipAddress = "";

    Object.values(nets).forEach((net) => {
      net.forEach((n) => {
        if (n.family === "IPv4" && !n.internal) {
          ipAddress = n.address;
        }
      });
    });

    // Create new attendance session
    const newAttendance = new Attendance({ classId, date, ipAddress });

    // Generate QR Code with attendance ID
    const frontend_url = process.env.FRONTED_URL;
    const qrCodeUrl = `${frontend_url}/${newAttendance._id}`;
    const qrCodeImage = await qr.toDataURL(qrCodeUrl);
    newAttendance.qrCode = qrCodeImage; // Store the QR in DB
    await newAttendance.save();
    res.json({ attendanceId: newAttendance._id, qrCode: qrCodeImage });
  } catch (error) {
    res.status(500).json({ message: "Error creating attendance", error });
  }
});

const requestIp = require("request-ip");

app.post("/mark-attendance/:attendanceId", async (req, res) => {
  const { attendanceId } = req.params;
  const { studentId, deviceId } = req.body;

  // Get client's IP address
  const clientIp = requestIp.getClientIp(req);

  try {
    // Get the attendance session
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance session not found" });
    }

    // ❌ Reject if student is on a different WiFi network
    if (attendance.ipAddress !== clientIp) {
      return res.status(403).json({ message: "Invalid WiFi network. Attendance marking not allowed." });
    }

    // ❌ Check if this student has already marked attendance from this device
    const existingLog = await AttendanceLog.findOne({ attendanceId, studentId, deviceId });
    if (existingLog) {
      return res.status(409).json({ message: "Attendance already marked from this device." });
    }

    // ✅ Mark attendance
    const newLog = new AttendanceLog({ attendanceId, studentId, deviceId, ipAddress: clientIp });
    await newLog.save();

    res.json({ message: "Attendance marked successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error marking attendance", error });
  }
});

app.get("/api/classes/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;
    const classes = await Class.find({ facultyId });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: "Error fetching classes", error });
  }
});

app.get("/api/attendances/:classId", async (req, res) => {
  const { classId } = req.params;
  try {
    const attendances = await Attendance.find({ classId });
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendances", error });
  }
});

app.get("/attendance/:id", async (req, res) => {
  const { id } = req.params;
  const attendance = await Attendance.findById(id);

  if (!attendance) {
    return res.status(404).json({ message: "Attendance not found" });
  }

  res.json({ qrCode: attendance.qrCode });
});

app.listen(5000, () => console.log("Server running on port 5000"));

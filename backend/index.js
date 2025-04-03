const express = require("express");
const mongoose = require("mongoose");
const qr = require("qrcode");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ClerkExpressWithAuth } = require("@clerk/clerk-sdk-node");
const requestIp = require("request-ip");
const crypto = require("crypto");
const os = require("os");
const { networkInterfaces } = os;
const dotenv = require("dotenv");
require("dotenv").config(); // Load env variables
const app = express();
app.use(express.json());

const allowedOrigins = ["http://localhost:5173", "https://qr-code-attendance-system-fe.onrender.com/"];

app.use(
  cors({
    origin: "*", // Allows all origins
  })
);
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_URI || "", { useNewUrlParser: true, useUnifiedTopology: true });

const FacultySchema = new mongoose.Schema({ name: String, email: String, clerkId: String });
const ClassSchema = new mongoose.Schema({ name: String, facultyId: mongoose.Schema.Types.ObjectId });
const StudentSchema = new mongoose.Schema({ name: String, rollNo: String, classId: mongoose.Schema.Types.ObjectId });

const AttendanceSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  date: { type: String, required: true },
  qrCode: String,
  ipAddress: { type: String, required: true }, // IP when QR was created
  subnet: { type: String, required: true }, // IP when QR was created
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

const getLocalSubnet = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        const subnet = net.address.split(".").slice(0, 3).join(".") + ".0"; // Example: 192.168.1.0
        return subnet;
      }
    }
  }
  return null;
};

app.post("/create-attendance", async (req, res) => {
  const { classId, date } = req.body;

  try {
    const ip = requestIp.getClientIp(req);
    const subnet = getLocalSubnet(); // Capture the local subnet
    const newAttendance = new Attendance({ classId, date });
    const frontend_url = process.env.FRONTEND_URL;
    const qrCodeUrl = `${frontend_url}/mark-attendance/${newAttendance._id}`;
    const qrCodeImage = await qr.toDataURL(qrCodeUrl);
    newAttendance.qrCode = qrCodeImage; // Store the QR in DB
    newAttendance.ipAddress = ip;
    newAttendance.subnet = subnet;
    await newAttendance.save();
    res.json({ attendanceId: newAttendance._id, qrCode: qrCodeImage });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error creating attendance", error });
  }
});

const isSameSubnet = (studentIp, storedSubnet) => {
  return studentIp.startsWith(storedSubnet.split(".").slice(0, 3).join("."));
};
app.post("/api/mark-attendance/:attendanceId", async (req, res) => {
  const { attendanceId } = req.params;
  const { studentId } = req.body;
  const deviceId = crypto
    .createHash("sha256")
    .update(req.headers["user-agent"] || "")
    .digest("hex");
  // Get client's IP address
  const clientIp = requestIp.getClientIp(req);
  try {
    // Get the attendance session
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance session not found" });
    }

    if (!isSameSubnet(clientIp, attendance.subnet)) {
      return res.status(403).json({ message: "Invalid WiFi network. Attendance marking not allowed." });
    }

    // ❌ Reject if student is on a different WiFi network
    if (attendance.ipAddress !== clientIp) {
      return res.status(403).json({ message: "Invalid WiFi network. Attendance marking not allowed." });
    }

    // ❌ Check if this student has already marked attendance from this device
    const existingLogDevice = await AttendanceLog.findOne({ attendanceId, deviceId });
    if (existingLogDevice) {
      return res.status(409).json({ message: "Attendance already marked from this device." });
    }
    const existingLog = await AttendanceLog.findOne({ attendanceId, deviceId, studentId });
    if (existingLog) {
      return res.status(409).json({ message: "Attendance already marked by student." });
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
app.get("/api/attendance/:attendanceId/verify", async (req, res) => {
  const { attendanceId } = req.params;
  const clientIp = requestIp.getClientIp(req);
  const deviceId = crypto
    .createHash("sha256")
    .update(req.headers["user-agent"] || "")
    .digest("hex");
  try {
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) return res.status(404).json({ success: false, message: "Attendance not found." });
    if (attendance.ipAddress !== clientIp) {
      return res.status(403).json({ success: false, message: "Must be on the same WiFi network!" });
    }
    if (!isSameSubnet(clientIp, attendance.subnet)) {
      return res.status(403).json({ message: "Invalid WiFi network. Attendance marking not allowed." });
    }
    const attendanceTaken = await AttendanceLog.findOne({ attendanceId, deviceId });
    if (attendanceTaken) {
      return res.status(403).json({ success: false, message: "Attendance already marked" });
    }
    res.json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get("/api/attendance/:attendanceId/students", async (req, res) => {
  const { attendanceId } = req.params;
  try {
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    const students = await Student.find({ classId: attendance.classId });
    res.json(students);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));

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
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
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
const StudentSchema = new mongoose.Schema({
  name: String,
  rollNo: String,
  classId: mongoose.Schema.Types.ObjectId,
  email: { type: String, required: true },
  parentEmail: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verifiedDeviceId: String,
  verifiedIpAddress: String,
  verifiedSubnet: String,
});

// Create compound index for email and classId
StudentSchema.index({ email: 1, classId: 1 }, { unique: true });

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
  photoUrl: { type: String }, // URL of the captured photo
});
const Faculty = mongoose.model("Faculty", FacultySchema);
const Class = mongoose.model("Class", ClassSchema);
const Student = mongoose.model("Student", StudentSchema);
const Attendance = mongoose.model("Attendance", AttendanceSchema);
const AttendanceLog = mongoose.model("AttendanceLog", AttendanceLogSchema);

// Create email transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
  debug: true, // Enable debug logging
});

// Verify email configuration
const verifyEmailConfig = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.error("Email configuration missing. Please check your .env file for EMAIL_USER and EMAIL_APP_PASSWORD");
    return false;
  }

  try {
    await transporter.verify();
    console.log("Email configuration is valid");
    return true;
  } catch (error) {
    console.error("Email configuration error:", error);
    return false;
  }
};

// Call verification on startup
verifyEmailConfig();

// Function to send attendance notification email
const sendAttendanceEmail = async (student, attendance, isPresent) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error("Email configuration missing");
  }

  const mailOptions = {
    from: `"Attendance System" <${process.env.EMAIL_USER}>`,
    to: student.parentEmail,
    subject: `Attendance Update for ${student.name} - ${new Date(attendance.date).toLocaleDateString()}`,
    html: `
      <h2>Attendance Update</h2>
      <p>Dear Parent/Guardian,</p>
      <p>This is to inform you about the attendance status of your ward:</p>
      <ul>
        <li><strong>Student Name:</strong> ${student.name}</li>
        <li><strong>Roll Number:</strong> ${student.rollNo}</li>
        <li><strong>Date:</strong> ${new Date(attendance.date).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(attendance.date).toLocaleTimeString()}</li>
        <li><strong>Status:</strong> ${isPresent ? "Present" : "Absent"}</li>
      </ul>
      <p>Thank you for your attention.</p>
      <p>Best regards,<br>Attendance Management System</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

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

// Update student creation endpoint to include email verification
app.post("/api/students", async (req, res) => {
  const { name, rollNo, classId, email, parentEmail } = req.body;

  if (!email || !parentEmail) {
    return res.status(400).json({ error: "Email and parent email are required" });
  }

  try {
    // Check if student with this email already exists
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ error: "Student with this email already exists" });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newStudent = await Student.create({
      name,
      rollNo,
      classId,
      email,
      parentEmail,
      verificationToken,
      isVerified: false,
    });

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-student/${verificationToken}`;
    const mailOptions = {
      from: `"Attendance System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Student Account",
      html: `
        <h2>Welcome to the Attendance System</h2>
        <p>Dear ${name},</p>
        <p>Please click the link below to verify your account and join your class:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Verify Account</a>
        <p>This link will only work once and will be used to verify your device for attendance marking.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Verification email sent successfully:", info.response);
      res.json({ message: "Student created. Verification email sent." });
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Still create the student but inform about email failure
      res.json({
        message: "Student created but verification email could not be sent. Please try again later.",
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error("Error creating student:", error);
    res.status(500).json({ error: "Failed to create student" });
  }
});

const getSubnetFromIp = (ip) => {
  if (!ip) {
    console.log("getSubnetFromIp: No IP provided");
    return null;
  }
  // Extract the first three octets of the IP address to represent the subnet
  const subnet = ip.split(".").slice(0, 3).join(".") + ".0";
  console.log(`getSubnetFromIp: IP ${ip} converted to subnet ${subnet}`);
  return subnet;
};

// Function to process attendance and send emails
const processAttendanceAndSendEmails = async (attendanceId) => {
  try {
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) return;

    const students = await Student.find({ classId: attendance.classId });
    const attendanceLogs = await AttendanceLog.find({ attendanceId });

    // Create a set of present student IDs for quick lookup
    const presentStudentIds = new Set(attendanceLogs.map((log) => log.studentId.toString()));

    // Send emails to all parents
    for (const student of students) {
      const isPresent = presentStudentIds.has(student._id.toString());
      await sendAttendanceEmail(student, attendance, isPresent);
    }
  } catch (error) {
    console.error("Error processing attendance emails:", error);
  }
};

// Update create-attendance endpoint to schedule email notifications
app.post("/create-attendance", async (req, res) => {
  const { classId, date } = req.body;

  try {
    const ip = requestIp.getClientIp(req);
    const subnet = getSubnetFromIp(ip);
    const newAttendance = new Attendance({ classId, date });
    const frontend_url = process.env.FRONTEND_URL;
    const qrCodeUrl = `${frontend_url}/mark-attendance/${newAttendance._id}`;
    const qrCodeImage = await qr.toDataURL(qrCodeUrl);
    newAttendance.qrCode = qrCodeImage;
    newAttendance.ipAddress = ip;
    newAttendance.subnet = subnet;
    await newAttendance.save();

    res.json({ attendanceId: newAttendance._id, qrCode: qrCodeImage });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error creating attendance", error });
  }
});

// Add new endpoint to manually trigger notifications
app.post("/api/attendance/:attendanceId/send-notifications", async (req, res) => {
  const { attendanceId } = req.params;
  try {
    await processAttendanceAndSendEmails(attendanceId);
    res.json({ message: "Attendance notifications sent successfully" });
  } catch (error) {
    console.error("Error sending notifications:", error);
    res.status(500).json({ message: "Error sending notifications", error });
  }
});

const isSameSubnet = (clientIp, storedSubnet) => {
  console.log(`isSameSubnet: Comparing client IP ${clientIp} with stored subnet ${storedSubnet}`);
  if (!clientIp || !storedSubnet) {
    console.log("isSameSubnet: Missing IP or subnet", { clientIp, storedSubnet });
    return false;
  }
  const clientSubnet = getSubnetFromIp(clientIp);
  const result = clientSubnet === storedSubnet;
  console.log(`isSameSubnet: Client subnet ${clientSubnet} matches stored subnet ${storedSubnet}: ${result}`);
  return result;
};

// Update the device ID generation function to be more consistent
const generateDeviceId = (userAgent) => {
  return crypto
    .createHash("sha256")
    .update(userAgent || "")
    .digest("hex");
};

// Update verify student endpoint
app.post("/api/verify-student/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const deviceId = generateDeviceId(req.headers["user-agent"]);
    const clientIp = requestIp.getClientIp(req);
    const subnet = getSubnetFromIp(clientIp);

    const student = await Student.findOne({ verificationToken: token });
    if (!student) {
      return res.status(404).json({ error: "Invalid verification token" });
    }

    if (student.isVerified) {
      return res.status(400).json({ error: "Student already verified" });
    }

    // Update student with device info and mark as verified
    student.isVerified = true;
    student.verifiedDeviceId = deviceId;
    student.verifiedIpAddress = clientIp;
    student.verifiedSubnet = subnet;
    student.verificationToken = undefined; // Remove the token after use
    await student.save();

    res.json({ message: "Student verified successfully" });
  } catch (error) {
    console.error("Error verifying student:", error);
    res.status(500).json({ error: "Failed to verify student" });
  }
});

// Update mark attendance endpoint
app.post("/api/mark-attendance/:attendanceId", async (req, res) => {
  const { attendanceId } = req.params;
  const { studentId, photoData } = req.body;
  const deviceId = generateDeviceId(req.headers["user-agent"]);
  const clientIp = requestIp.getClientIp(req);
  console.log(`Marking attendance - Client IP: ${clientIp}`);

  try {
    // Get the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.isVerified) {
      return res.status(403).json({ message: "Student account not verified" });
    }

    // Get the attendance session
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance session not found" });
    }

    console.log(`Attendance session details - IP: ${attendance.ipAddress}, Subnet: ${attendance.subnet}`);

    // Check if student is in the class
    if (student.classId.toString() !== attendance.classId.toString()) {
      return res.status(403).json({ message: "Student is not enrolled in this class" });
    }

    // Check if student is using their verified device
    if (student.verifiedDeviceId !== deviceId) {
      console.log("Device ID mismatch:", {
        verified: student.verifiedDeviceId,
        current: deviceId,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({
        message: "Attendance can only be marked from your verified device",
        details: "Please use the same device you used for verification",
      });
    }

    // Check if student is on the same network as when they verified
    if (!isSameSubnet(clientIp, student.verifiedSubnet)) {
      console.log("Network verification failed:", {
        clientIp,
        verifiedSubnet: student.verifiedSubnet,
        clientSubnet: getSubnetFromIp(clientIp),
      });
      return res.status(403).json({ message: "Must be on the same network as when you verified your account" });
    }

    // Check if attendance already marked
    const existingLog = await AttendanceLog.findOne({ attendanceId, studentId });
    if (existingLog) {
      return res.status(409).json({ message: "Attendance already marked" });
    }

    // Upload photo to Cloudinary if provided
    let photoUrl = null;
    if (photoData) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(`data:image/jpeg;base64,${photoData}`, {
          folder: "attendance_photos",
          resource_type: "auto",
        });
        photoUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("Error uploading photo:", uploadError);
        return res.status(500).json({ message: "Error uploading photo" });
      }
    }

    // Mark attendance
    const newLog = new AttendanceLog({
      attendanceId,
      studentId,
      deviceId,
      ipAddress: clientIp,
      photoUrl,
    });
    await newLog.save();

    res.json({ message: "Attendance marked successfully", photoUrl });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ message: "Error marking attendance", error: error.message });
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
  try {
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found" });
    }

    // Get all students in the class
    const students = await Student.find({ classId: attendance.classId });

    // Get all attendance logs for this session
    const attendanceLogs = await AttendanceLog.find({ attendanceId: id });

    // Create a map of attendance logs for quick lookup
    const attendanceLogMap = new Map(attendanceLogs.map((log) => [log.studentId.toString(), log]));

    // Add attendance status and photo URL to each student
    const studentsWithAttendance = students.map((student) => {
      const log = attendanceLogMap.get(student._id.toString());
      return {
        ...student.toObject(),
        hasMarkedAttendance: !!log,
        photoUrl: log?.photoUrl || null,
        markedAt: log?.timestamp || null,
      };
    });

    res.json({
      qrCode: attendance.qrCode,
      date: attendance.date,
      students: studentsWithAttendance,
      totalStudents: students.length,
      presentCount: attendanceLogs.length,
      absentCount: students.length - attendanceLogs.length,
    });
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    res.status(500).json({ message: "Error fetching attendance details" });
  }
});
app.get("/api/attendance/:attendanceId/verify", async (req, res) => {
  const { attendanceId } = req.params;
  const ip = requestIp.getClientIp(req);
  const deviceId = crypto
    .createHash("sha256")
    .update(req.headers["user-agent"] || "")
    .digest("hex");
  try {
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) return res.status(404).json({ success: false, message: "Attendance not found." });
    if (attendance.ipAddress !== ip) {
      return res.status(403).json({ success: false, message: "Must be on the same WiFi network!" });
    }
    if (!isSameSubnet(clientIp, attendance.subnet)) {
      console.log("Invalid WiFi network. Attendance marking not allowed.");
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

    // Get all students in the class
    const students = await Student.find({ classId: attendance.classId });

    // Get all attendance logs for this session
    const attendanceLogs = await AttendanceLog.find({ attendanceId });

    // Create a set of student IDs who have marked attendance
    const presentStudentIds = new Set(attendanceLogs.map((log) => log.studentId.toString()));

    // Add attendance status to each student
    const studentsWithAttendance = students.map((student) => ({
      ...student.toObject(),
      hasMarkedAttendance: presentStudentIds.has(student._id.toString()),
    }));

    res.json(studentsWithAttendance);
  } catch (error) {
    console.error("Error fetching students with attendance:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get student attendance history
app.get("/api/students/:studentId/attendance-history", async (req, res) => {
  try {
    const { studentId } = req.params;

    // First, get the student to find their class
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get all attendance sessions for this class
    const attendanceSessions = await Attendance.find({ classId: student.classId }).sort({ date: -1 }); // Sort by date in descending order

    // Get all attendance logs for this student
    const attendanceLogs = await AttendanceLog.find({ studentId });

    // Create a map of attendance logs for quick lookup
    const attendanceLogMap = new Map(attendanceLogs.map((log) => [log.attendanceId.toString(), log]));

    // Create history records for all attendance sessions
    const history = attendanceSessions.map((session) => {
      const log = attendanceLogMap.get(session._id.toString());
      return {
        _id: session._id,
        date: session.date,
        status: log ? "present" : "absent", // If there's no log, student is absent
        markedAt: log ? log.timestamp : null,
      };
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching student attendance history:", error);
    res.status(500).json({ error: "Failed to fetch attendance history" });
  }
});

// Add delete student endpoint
app.delete("/api/students/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find the student first to get their class ID
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get all attendance sessions for this class
    const attendanceSessions = await Attendance.find({ classId: student.classId });
    const attendanceIds = attendanceSessions.map((session) => session._id);

    // Delete all attendance logs for this student across all sessions
    await AttendanceLog.deleteMany({
      studentId: studentId,
      attendanceId: { $in: attendanceIds },
    });

    // Delete the student
    await Student.findByIdAndDelete(studentId);

    res.json({
      message: "Student and all associated attendance records deleted successfully",
      deletedStudent: {
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
      },
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ error: "Failed to delete student and associated records" });
  }
});

// Add delete attendance endpoint
app.delete("/api/attendance/:attendanceId", async (req, res) => {
  try {
    const { attendanceId } = req.params;

    // Find the attendance session first
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ error: "Attendance session not found" });
    }

    // Delete all attendance logs for this session
    await AttendanceLog.deleteMany({ attendanceId });

    // Delete the attendance session
    await Attendance.findByIdAndDelete(attendanceId);

    res.json({
      message: "Attendance session and all associated records deleted successfully",
      deletedAttendance: {
        date: attendance.date,
        classId: attendance.classId,
      },
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({ error: "Failed to delete attendance session" });
  }
});

// Configure Cloudinary
cloudinary.config({
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
});

app.listen(5000, () => console.log("Server running on port 5000"));

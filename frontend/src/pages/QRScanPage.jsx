import { useState } from "react";
import QrScanner from "react-qr-scanner";
import React from "react";
export default function QrScanPage() {
  const [scannedData, setScannedData] = useState("");

  const handleScan = (data) => {
    if (data) {
      setScannedData(data);
      window.location.href = data; // Redirect to attendance API
    }
  };

  return (
    <div>
      <h2>Scan the QR Code to Mark Attendance</h2>
      <QrScanner delay={300} onScan={handleScan} />
      {scannedData && <p>Redirecting to: {scannedData}</p>}
    </div>
  );
}

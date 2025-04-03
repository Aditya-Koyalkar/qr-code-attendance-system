import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const AttendancePage = () => {
  const { id } = useParams();
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    axios
      .get(`http://localhost:5000/attendance/${id}`)
      .then((response) => {
        setQrCode(response.data.qrCode);
      })
      .catch((error) => {
        console.error("Error fetching QR Code:", error);
      });
  }, [id]);

  return (
    <div>
      <h1>Attendance QR Code</h1>
      {qrCode ? <img src={qrCode} alt="Attendance QR Code" /> : <p>Loading...</p>}
    </div>
  );
};

export default AttendancePage;

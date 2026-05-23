const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");
const Tesseract = require("tesseract.js");

const app = express();

app.use(express.json({ limit: "10mb" }));

// =========================
// LINE TOKEN
// =========================
const CHANNEL_ACCESS_TOKEN =
  process.env.CHANNEL_ACCESS_TOKEN;

// =========================
// GOOGLE SHEETS
// =========================
const spreadsheetId =
  "1nE5hTVN0MFrvD3-mHsy0PcjRqmSDPA2RwUVh6y9ubec";

const credentials = JSON.parse(
  process.env.GOOGLE_CREDENTIALS
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

// =========================
// WEBHOOK
// =========================
app.post("/webhook", async (req, res) => {

  try {

    const events = req.body.events;

    for (const event of events) {

      if (
        event.type === "message" &&
        event.message.type === "image"
      ) {

        const messageId = event.message.id;

        console.log("ได้รับรูปแล้ว");

        // =========================
        // โหลดรูปจาก LINE
        // =========================
        const imageResponse = await axios({
          method: "get",
          url:
            `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          responseType: "arraybuffer",
          headers: {
            Authorization:
              `Bearer ${CHANNEL_ACCESS_TOKEN}`,
          },
        });

        // =========================
        // เซฟไฟล์ชั่วคราว
        // =========================
        const filePath =
          `/tmp/image-${messageId}.jpg`;

        fs.writeFileSync(
          filePath,
          imageResponse.data
        );

        console.log("เซฟรูปแล้ว");

        // =========================
        // OCR
        // =========================
        const result =
          await Tesseract.recognize(
            filePath,
            "tha+eng"
          );

        const text =
          result.data.text || "";

        console.log("อ่านข้อความได้:");
        console.log(text);

        // =========================
        // ทำความสะอาดข้อความ
        // =========================
        const cleanText = text
          .replace(/\r/g, "")
          .replace(/\n/g, " ");

        // =========================
        // หาเลขทะเบียน
        // ตัวอย่าง:
        // กข 1234
        // 1กข1234
        // =========================
        const plateMatch =
          cleanText.match(
            /([0-9]?[ก-ฮ]{1,3}\s?[0-9]{1,4})/
          );

        // =========================
        // หาวันหมดอายุ
        // ตัวอย่าง:
        // 12 ม.ค. 2568
        // 1 มกราคม 2568
        // =========================
        const expireMatch =
          cleanText.match(
            /([0-9]{1,2}\s?(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s?[0-9]{2,4})/
          );

        const ทะเบียน =
          plateMatch
            ? plateMatch[0]
            : "ไม่พบทะเบียน";

        const หมดอายุ =
          expireMatch
            ? expireMatch[0]
            : "ไม่พบวันหมดอายุ";

        console.log("ทะเบียน:", ทะเบียน);
        console.log("หมดอายุ:", หมดอายุ);

        // =========================
        // Google Sheets
        // =========================
        const sheets = google.sheets({
          version: "v4",
          auth,
        });

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Sheet1!A:C",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              ทะเบียน,
              หมดอายุ,
              new Date().toLocaleString("th-TH"),
            ]],
          },
        });

        console.log(
          "บันทึกลง Google Sheets แล้ว"
        );

        // =========================
        // ลบรูป
        // =========================
        fs.unlinkSync(filePath);
      }
    }

    res.sendStatus(200);

  } catch (error) {

    console.log("ERROR:");
    console.log(error);

    res.sendStatus(500);
  }
});

// =========================
// TEST ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

// =========================
// START SERVER
// =========================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running");
});

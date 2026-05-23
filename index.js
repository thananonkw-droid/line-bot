const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");
const Tesseract = require("tesseract.js");

const app = express();

app.use(express.json());

// LINE TOKEN
const CHANNEL_ACCESS_TOKEN =
  "dR0JGAVhuY3Pk9iK5iMfjdgZnZfxlekkwKEZsxn/EDsNLJyHEjk1d6Qx9PRJujHLXs4tSvsP40BxIJH12m0mUsmHzriwIxl6z0HIw5p7rK7nxJmZCfX6TR6WpepIehR6ceriSUpCeztaylutZjowqgdB04t89/1O/w1cDnyilFU=";

// GOOGLE SHEET ID
const spreadsheetId =
  "1nE5hTVN0MFrvD3-mHsy0PcjRqmSDPA2RwUVh6y9ubec";

// GOOGLE CREDENTIALS
const credentials = JSON.parse(
  process.env.GOOGLE_CREDENTIALS
);

// GOOGLE AUTH
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

// WEBHOOK
app.post("/webhook", async (req, res) => {

  const events = req.body.events;

  for (const event of events) {

    // รับเฉพาะรูป
    if (
      event.type === "message" &&
      event.message.type === "image"
    ) {

      const messageId = event.message.id;

      try {

        // โหลดรูปจาก LINE
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

        // เซฟรูป
        const filePath =
          `image-${messageId}.jpg`;

        fs.writeFileSync(
          filePath,
          imageResponse.data
        );

        console.log("เซฟรูปแล้ว");

        // OCR อ่านข้อความ
        const result =
          await Tesseract.recognize(
            filePath,
            "eng"
          );

        const text =
          result.data.text || "";

        console.log("อ่านข้อความได้:");
        console.log(text);

        // หาเลขปี พ.ศ.
        const ปีMatch =
          text.match(/25\d{2}/);

        const หมดอายุ =
          ปีMatch
            ? ปีMatch[0]
            : "ไม่พบ";

        // หาเลขทะเบียน
        const ทะเบียนMatch =
          text.match(
            /[A-Z0-9ก-ฮ]{1,3}\s?[0-9]{1,4}/
          );

        const ทะเบียน =
          ทะเบียนMatch
            ? ทะเบียนMatch[0]
            : "ไม่พบ";

        console.log("ทะเบียน:", ทะเบียน);
        console.log("หมดอายุ:", หมดอายุ);

        // GOOGLE SHEETS
        const sheets = google.sheets({
          version: "v4",
          auth,
        });

        // บันทึกลงชีต
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Sheet1!A:C",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[
              ทะเบียน,
              หมดอายุ,
              new Date().toLocaleString(),
            ]],
          },
        });

        console.log(
          "บันทึกลง Google Sheets แล้ว"
        );

        // ลบรูปหลังใช้งาน
        fs.unlinkSync(filePath);

      } catch (error) {

        console.log("ERROR:");
        console.log(error);

      }
    }
  }

  res.sendStatus(200);
});

// TEST
app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

// START SERVER
app.listen(3000, () => {
  console.log("Server running");
});
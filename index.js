const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");
const Tesseract = require("tesseract.js");

const app = express();

app.use(express.json());

const CHANNEL_ACCESS_TOKEN =
  "dR0JGAVhuY3Pk9iK5iMfjdgZnZfxlekkwKEZsxn/EDsNLJyHEjk1d6Qx9PRJujHLXs4tSvsP40BxIJH12m0mUsmHzriwIxl6z0HIw5p7rK7nxJmZCfX6TR6WpepIehR6ceriSUpCeztaylutZjowqgdB04t89/1O/w1cDnyilFU=";

const spreadsheetId =
  "1nE5hTVN0MFrvD3-mHsy0PcjRqmSDPA2RwUVh6y9ubec";

// Google Sheets
const credentials = JSON.parse(
  process.env.GOOGLE_CREDENTIALS
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

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
          url: `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
          },
        });

        // เซฟรูป
        const filePath = `image-${messageId}.jpg`;

        fs.writeFileSync(
          filePath,
          imageResponse.data
        );

        console.log("เซฟรูปแล้ว");

        // OCR อ่านข้อความ
        const result =
          await Tesseract.recognize(
            filePath,
            "tha+eng"
          );

        const text =
          result.data.text || "";

        console.log("อ่านข้อความได้:");
        console.log(text);

        // แยกข้อมูลแบบง่าย
        const lines = text.split("\n");

        const ทะเบียน = lines[0] || "";
        const หมดอายุ = lines[1] || "";

        // Google Sheets
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

      } catch (error) {

        console.log("ERROR:");
        console.log(error);

      }
    }
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

app.listen(3000, () => {
  console.log("Server running");
});

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer config
const upload = multer({ dest: 'uploads/' });

// API endpoint
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const { promptText, duration } = req.body;

    const payload = {
      promptImage: dataUri,
      promptText: promptText,
      duration: parseInt(duration, 10),
      model: 'gen4_turbo',
      ratio: '1280:720',
      contentModeration: {
        publicFigureThreshold: 'auto'
      }
    };

    const runwayResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify(payload)
    });

    await fs.unlink(filePath); // clean up temp file

    if (!runwayResponse.ok) {
      const errorText = await runwayResponse.text();
      console.error('❌ Runway API error:', errorText);
      return res.status(500).json({ error: 'Runway API error', detail: errorText });
    }

    const responseData = await runwayResponse.json();
    return res.json(responseData);

  } catch (err) {
    console.error('❌ Error while generating video:', err);
    res.status(500).json({ error: 'Server error starting generation.', detail: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

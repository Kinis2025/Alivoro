import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { prompt, duration, ratio } = req.body;

    // Izvēlētais runway ratio un izmērs
    const validRatios = {
      landscape: { ratio: '1280:720', width: 1280, height: 720 },
      portrait: { ratio: '720:1280', width: 720, height: 1280 },
    };

    if (!validRatios[ratio]) {
      return res.status(400).json({ error: 'Invalid ratio selected.' });
    }

    const { width, height, ratio: runwayRatio } = validRatios[ratio];

    // Sagatavo attēlu (resize ar fonu)
    const resizedImageBuffer = await sharp(req.file.buffer)
      .resize({
        width,
        height,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0 },
      })
      .toFormat('jpeg')
      .toBuffer();

    const base64Image = resizedImageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // Runway API pieprasījums
    const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptText: prompt,
        duration: parseInt(duration),
        ratio: runwayRatio,
        promptImage: dataUri,
        contentModeration: {
          publicFigureThreshold: 'auto',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Runway error:', data);
      return res.status(500).json({ error: data.error || 'Runway API error.' });
    }

    res.json({ video_url: `https://api.dev.runwayml.com/v1/tasks/${data.id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.get('/api/task/:id', async (req, res) => {
  const taskId = req.params.id;

  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error fetching task:', data);
      return res.status(500).json({ error: data.error || 'Runway task fetch error' });
    }

    res.json(data);
  } catch (err) {
    console.error('Fetch task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

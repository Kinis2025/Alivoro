import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
const upload = multer();

// API maršruts
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { promptText, duration } = req.body;
    const imageBuffer = req.file?.buffer;

    if (!promptText || !imageBuffer) {
      return res.status(400).json({ error: 'Missing prompt or image.' });
    }

    const dataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;

    const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        promptImage: dataUri,
        promptText,
        duration: parseInt(duration) || 5,
        model: 'gen4_turbo',
        ratio: '1280:720',
        contentModeration: {
          publicFigureThreshold: 'auto'
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Runway API error', details: err });
    }

    const result = await response.json();
    res.json(result);

  } catch (err) {
    console.error('Error generating video:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

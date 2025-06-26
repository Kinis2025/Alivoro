import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import sharp from 'sharp';

dotenv.config();

const app = express();
const upload = multer();
const port = process.env.PORT || 3000;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
const RUNWAY_VERSION = '2024-11-06';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { prompt, duration } = req.body;
    const imageBuffer = req.file?.buffer;

    if (!prompt || !duration || !imageBuffer) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Izgūstam attēla izmērus un pārbaudām malu attiecību
    const metadata = await sharp(imageBuffer).metadata();
    const aspectRatio = metadata.width / metadata.height;

    if (aspectRatio < 0.5 || aspectRatio > 2) {
      return res.status(400).json({
        error: `Invalid aspect ratio: ${aspectRatio.toFixed(3)}. Must be between 0.5 and 2.`
      });
    }

    // Konvertē uz base64 data URI
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    // Aprēķina piemērotu attiecību formātā 'W:H'
    let ratio = '1:1';
    if (aspectRatio > 1.5) ratio = '16:9';
    else if (aspectRatio < 0.67) ratio = '9:16';
    else ratio = '4:3';

    const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': RUNWAY_VERSION
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptText: prompt,
        duration: parseInt(duration),
        ratio,
        promptImage: dataUri,
        contentModeration: { publicFigureThreshold: 'auto' }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Runway error:', data);
      return res.status(500).json({ error: 'Runway API error', details: data });
    }

    const taskId = data.id;
    let attempts = 0;
    const maxAttempts = 20;
    let videoUrl = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': RUNWAY_VERSION
        }
      });

      const statusData = await statusResponse.json();

      if (statusData.status === 'SUCCEEDED') {
        videoUrl = statusData.output?.videoUri;
        break;
      } else if (['FAILED', 'CANCELLED'].includes(statusData.status)) {
        return res.status(500).json({ error: 'Runway task failed', details: statusData });
      }

      attempts++;
    }

    if (!videoUrl) {
      return res.status(408).json({ error: 'Video generation timed out' });
    }

    res.json({ video_url: videoUrl });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

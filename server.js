import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');
    const promptImage = `data:image/png;base64,${base64Image}`;

    const runwayResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptImage,
        promptText: req.body.prompt,
        model: 'gen4_turbo',
        ratio: '1280:720',
        duration: Number(req.body.duration) || 5,
        contentModeration: {
          publicFigureThreshold: 'auto'
        }
      })
    });

    if (!runwayResponse.ok) {
      const error = await runwayResponse.text();
      return res.status(500).json({ error: `Runway API Error: ${error}` });
    }

    const result = await runwayResponse.json();
    res.json({ taskId: result.id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error starting generation.' });
  }
});

app.get('/api/status/:taskId', async (req, res) => {
  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${req.params.taskId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
      }
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task status' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

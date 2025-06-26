import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/generate', async (req, res) => {
  try {
    const { imageUrl, promptText } = req.body;

    // 1. Sākam ģenerāciju
    const startResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        promptImage: {
          uri: imageUrl,
          position: "first"
        },
        model: "gen4_turbo",
        ratio: "720:1280",
        promptText: promptText,
        duration: 5
      })
    });

    const startData = await startResponse.json();
    const taskId = startData.id;

    if (!taskId) {
      return res.status(500).json({ error: 'Failed to start generation task.' });
    }

    // 2. Pārbauda task statusu līdz tas gatavs
    let status = 'PENDING';
    let videoUrl = null;

    while (status === 'PENDING' || status === 'STARTED' || status === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sek. pauze
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
        }
      });

      const statusData = await statusResponse.json();
      status = statusData.status;

      if (status === 'SUCCEEDED') {
        videoUrl = statusData.output?.videoUri || null;
        break;
      } else if (status === 'FAILED') {
        return res.status(500).json({ error: 'Video generation failed.' });
      }
    }

    if (videoUrl) {
      res.json({ videoUrl });
    } else {
      res.status(500).json({ error: 'Video generation did not complete in time.' });
    }

  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Server error during video generation' });
  }
});

app.get('/', (req, res) => {
  res.send('Alivoro Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

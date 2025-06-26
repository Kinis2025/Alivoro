import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import FormData from 'form-data';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { prompt, duration } = req.body;
    const image = req.file;

    if (!prompt || !image) {
      return res.status(400).json({ error: 'Prompt or image is missing.' });
    }

    // Upload image to Runway
    const imageForm = new FormData();
    imageForm.append('file', fs.createReadStream(image.path));
    const uploadRes = await fetch('https://api.runwayml.com/v2/assets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
      },
      body: imageForm,
    });

    const uploadedImage = await uploadRes.json();
    if (!uploadedImage?.url) {
      return res.status(500).json({ error: 'Failed to upload image to Runway.' });
    }

    const imageUrl = uploadedImage.url;

    // Start Gen-4 video generation task
    const runGenerationResponse = await fetch('https://api.runwayml.com/v2/generate/video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gen-4',
        input: {
          image_url: imageUrl,
          prompt: prompt,
          seed: Math.floor(Math.random() * 10000),
          duration: parseInt(duration) || 5,
          output_format: 'mp4',
        },
      }),
    });

    const generationData = await runGenerationResponse.json();

    if (!generationData?.id) {
      return res.status(500).json({ error: 'Failed to start generation task.' });
    }

    const taskId = generationData.id;

    // Poll for completion
    let videoUrl = null;
    const pollingEndpoint = `https://api.runwayml.com/v2/tasks/${taskId}`;
    for (let i = 0; i < 20; i++) {
      const statusResponse = await fetch(pollingEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNWAY_API_KEY}`,
        },
      });
      const statusData = await statusResponse.json();
      if (statusData.status === 'succeeded') {
        videoUrl = statusData.result?.output?.url;
        break;
      } else if (statusData.status === 'failed') {
        return res.status(500).json({ error: 'Video generation failed.' });
      }
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec pause
    }

    if (!videoUrl) {
      return res.status(500).json({ error: 'Video URL missing in response.' });
    }

    res.json({ video_url: videoUrl });

    // Cleanup
    fs.unlink(image.path, () => {});
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: 'Server error during generation.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

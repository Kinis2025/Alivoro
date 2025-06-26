import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // lai var apstrādāt liela izmēra base64 attēlus

// Helper funkcija: nogaida ms milisekundes
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post('/api/generate', async (req, res) => {
  try {
    const { promptText, duration, promptImage } = req.body;

    // Validācija
    if (!promptText || !duration || !promptImage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validē, vai attēls ir data URI
    const matches = promptImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');

    // Izveido multipart form-data pieprasījumu
    const form = new FormData();
    form.append('promptImage', imageBuffer, { filename: 'image.png', contentType: matches[1] });
    form.append('model', 'gen4_turbo');
    form.append('promptText', promptText);
    form.append('duration', duration);
    form.append('ratio', '1280:720'); // izvēlēts viens no gen4 atbalstītajiem

    // Sūta POST pieprasījumu uz Runway
    const createResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
        ...form.getHeaders()
      },
      body: form
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return res.status(500).json({ error: 'Failed to create task', details: errorText });
    }

    const createData = await createResponse.json();
    const taskId = createData.id;

    // Polling: ik pēc 5s pārbauda statusu
    let videoUrl = null;
    for (let i = 0; i < 12; i++) {
      await delay(5000);

      const checkResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
        }
      });

      const statusData = await checkResponse.json();
      if (statusData.status === 'SUCCEEDED' && statusData.output?.videoUri) {
        videoUrl = statusData.output.videoUri;
        break;
      } else if (statusData.status === 'FAILED') {
        return res.status(500).json({ error: 'Video generation failed', details: statusData });
      }
    }

    if (!videoUrl) {
      return res.status(504).json({ error: 'Video generation timed out' });
    }

    res.json({ videoUrl });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

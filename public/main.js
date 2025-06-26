// main.js

const form = document.getElementById('form');
const resultDiv = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKey = document.getElementById('apikey').value.trim();
  const promptText = document.getElementById('prompt').value.trim();
  const duration = parseInt(document.getElementById('duration').value, 10);
  const imageFile = document.getElementById('imageInput').files[0];

  if (!apiKey || !promptText || !imageFile) {
    alert('Please fill out all fields');
    return;
  }

  resultDiv.innerText = 'Generating...';

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Image = reader.result.replace(/^data:image\/[a-z]+;base64,/, "");

    try {
      const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          promptImage: `data:image/jpeg;base64,${base64Image}`,
          model: "gen4_turbo",
          promptText: promptText,
          duration: duration,
          ratio: "1280:720",
          seed: Math.floor(Math.random() * 4294967295),
          contentModeration: {
            publicFigureThreshold: "auto"
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      resultDiv.innerText = `Task submitted. Task ID: ${data.id}`;
      // Optionally: you can now fetch task status every few seconds
    } catch (error) {
      console.error(error);
      resultDiv.innerText = `Error: ${error.message}`;
    }
  };

  reader.readAsDataURL(imageFile);
});

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const prompt = document.getElementById('prompt').value.trim();
  const duration = parseInt(document.getElementById('duration').value, 10);
  const imageFile = document.getElementById('imageInput').files[0];

  if (!prompt || !imageFile || !duration) {
    alert('Please fill out all fields');
    return;
  }

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Image = reader.result;

    document.getElementById('result').innerText = 'Generating...';

    try {
      const response = await fetch('https://alivoro-server.onrender.com/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          duration,
          image: base64Image,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        document.getElementById('result').innerHTML = `
          <p>Video generated!</p>
          <video controls src="${data.videoUrl}" width="480"></video>
        `;
      } else {
        document.getElementById('result').innerText = 'Error: ' + data.error;
      }
    } catch (error) {
      console.error(error);
      document.getElementById('result').innerText = 'Error: ' + error.message;
    }
  };

  reader.readAsDataURL(imageFile);
});

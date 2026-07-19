const express = require('express');
const multer = require('multer');
const upload = multer();
const app = express();

app.post('/test', upload.none(), (req, res) => {
  console.log("Received:", req.body.text);
  console.log("Latin1 to UTF8:", Buffer.from(req.body.text, 'latin1').toString('utf8'));
  res.json({ text: req.body.text });
});

app.listen(5001, () => console.log('Listening on 5001'));

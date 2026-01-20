require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const dns = require('node:dns').promises;

// connect to mongoose
mongoose.connect(process.env.MONGO_URI).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// create a mongoose schema
const urlSchema = new mongoose.Schema({
  original: String,
  short: Number
});

// create a mongoose model
let UrlModel = mongoose.model("UrlModel", urlSchema);

// Basic Configuration
const port = process.env.PORT || 3000;

// use express.json() middleware as a body parser for json
app.use(express.json());

// parse urlencoded form data
app.use(express.urlencoded({ extended: true }));

// enable CORS globally (needed for FCC tests)
app.use(cors());

// serve static files
app.use('/public', express.static(`${process.cwd()}/public`));

// serve homepage
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// sample API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// POST route to create a shortened URL
app.post("/api/shorturl", async (req, res) => {

  // get the provided url
  const url = req.body.url;

  // check if the url exists
  if (!url) {
    return res.json({ error: "invalid url" });
  }

  // validate URL syntax
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    return res.json({ error: 'invalid url' });
  }

  // verify the submitted URL using DNS
  try {
    await dns.lookup(parsedUrl.hostname);
  } catch {
    return res.json({ error: 'invalid url' });
  }

  try {
    // check if the url already exists in the database
    let foundUrl = await UrlModel.findOne({ original: url });

    // if it is in the database, return the url and the shortened url
    if (foundUrl) {
      return res.json({
        original_url: foundUrl.original,
        short_url: foundUrl.short
      });
    }

    // else create a new entry in the database
    const count = await UrlModel.countDocuments({});
    const newUrl = new UrlModel({
      original: url,
      short: count + 1
    });

    const savedUrl = await newUrl.save();

    return res.json({
      original_url: savedUrl.original,
      short_url: savedUrl.short
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET route to redirect short URL to original
// GET route to redirect short URL to original
app.get('/api/shorturl/:shortUrl', async (req, res) => {

  // get the shorturl
  const short = Number(req.params.shortUrl);

  // validate that it's a number
  if (isNaN(short)) {
    return res.json({ error: 'Wrong format' });
  }

  try {
    // check if the shorturl exists in the database
    const foundUrl = await UrlModel.findOne({ short });

    // if it doesn't exist, return an error
    if (!foundUrl) {
      return res.json({ error: 'No short URL found for the given input' });
    }

    // if it exists, redirect to the original URL
    return res.redirect(301, foundUrl.original);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// start server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

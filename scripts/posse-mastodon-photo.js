// Get environment variables
require("dotenv").config();

// Native Node modules
const path = require("node:path");
const fs = require("fs");

// Third party dependencies
const fetch = require("node-fetch");

// Local dependencies
const createToot = require("../lib/create-toot.js");

// Cache of toots already sent
const CACHE_FILE = "cache/posse-mastodon-photo.json";
const jsonCache = require(path.join("..", CACHE_FILE)) || {};
const TIMESTAMP_FILE = "cache/posse-mastodon-photo-timestamp.json";
const jsonTimestamp = require(path.join("..", TIMESTAMP_FILE)) || {};
let cacheUpdated = false;

const MINUTES_BETWEEN_PHOTOS = 10;

const main = async () => {
  // Don't run this script more than every MINUTES_BETWEEN_PHOTOS minutes
  if (
    Date.now() <
    jsonTimestamp.timestamp + MINUTES_BETWEEN_PHOTOS * 60 * 1000
  ) {
    return;
  }

  // Helper Function to return unknown errors
  const handleError = (error) => {
    const msg = Array.isArray(error) ? error[0].message : error.message;
    process.exitCode = 1;
    // TODO: no need to return
    return status(422, String(msg));
  };

  // Helper Function to return function status
  const status = (code, msg) => {
    console.log(`[${code}] ${msg}`);
    // TODO: no need to return
    return {
      statusCode: code,
      body: msg,
    };
  };

  const processFeed = async (feed) => {
    let photos = feed.items;

    // Fill cache with new items
    photos.forEach((photo, index) => {
      if (!jsonCache.hasOwnProperty(photo.url)) {
        // This is a new photo
        jsonCache[photo.url] = { times: 0 };
      }
    });

    // Get lowest number of toots for any photo
    let minTimes = -1;
    const photosPerTimes = {};
    for (const photoUrl in jsonCache) {
      const photoTimes = jsonCache[photoUrl].times;
      minTimes = minTimes === -1 ? photoTimes : Math.min(minTimes, photoTimes);
      if (!photosPerTimes.hasOwnProperty(photoTimes)) {
        photosPerTimes[photoTimes] = [];
      }
      photosPerTimes[photoTimes].push({
        url: photoUrl,
        data: jsonCache[photoUrl],
      });
    }
    // Keep only recent photos that have been POSSEd the less
    const candidates = photosPerTimes[minTimes];

    const photoToPosse =
      candidates[Math.floor(Math.random() * candidates.length)].data;
    console.dir(photoToPosse);

    try {
      return createToot(photoToPosse);
    } catch (error) {
      return handleError(error);
    }
  };

  // TODO: use Promise.allSettled to continue even if one is rejected
  let result = await Promise.all(
    ["https://nicolas-hoizey.photo/feeds/mastodon/photos-test.json"].map(
      async (feedUrl) => {
        console.log(`Fetching ${feedUrl} …`);
        return fetch(feedUrl)
          .then((response) => response.json())
          .then(processFeed)
          .catch(handleError);
      }
    )
  );
  if (cacheUpdated) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(jsonCache, null, 2), {
      encoding: "utf8",
    });
    fs.writeFileSync(TIMESTAMP_FILE, JSON.stringify(jsonTimestamp, null, 2), {
      encoding: "utf8",
    });
  }
  // TODO: parse `result` to find potential errors and return accordingly
  // TODO: no need to return
  return { statusCode: 200, body: JSON.stringify(result) };
};

main();

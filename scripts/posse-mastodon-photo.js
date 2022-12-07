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
const jsonCache = require(path.join("..", CACHE_FILE));
const TIMESTAMP_FILE = "cache/posse-mastodon-photo-timestamp.json";
const jsonTimestamp = require(path.join("..", TIMESTAMP_FILE));

// const MINUTES_BETWEEN_PHOTOS = 60 * 23; // 23 hours
const MINUTES_BETWEEN_PHOTOS = 5; // 5 minutes

const main = async () => {
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

  // Don't run this script more than every MINUTES_BETWEEN_PHOTOS minutes
  if (
    Date.now() <
    jsonTimestamp.timestamp + MINUTES_BETWEEN_PHOTOS * 60 * 1000
  ) {
    return status(200, "Too soon");
  }

  const processFeed = async (feed) => {
    let items = feed.items;

    // Fill cache with new items
    items.forEach((item, index) => {
      if (jsonCache.hasOwnProperty(item.url)) {
        const existingToots = [...jsonCache[item.url].toots];
        jsonCache[item.url] = item;
        jsonCache[item.url].toots = existingToots;
      } else {
        // This is a new photo
        jsonCache[item.url] = item;
        jsonCache[item.url].toots = [];
      }
    });

    // Get lowest number of toots for any photo
    let minTimes = -1;
    const photosPerTimes = {};
    for (const photoUrl in jsonCache) {
      const photoTimes = jsonCache[photoUrl].toots.length;
      minTimes = minTimes === -1 ? photoTimes : Math.min(minTimes, photoTimes);
      if (!photosPerTimes.hasOwnProperty(photoTimes)) {
        photosPerTimes[photoTimes] = [];
      }
      photosPerTimes[photoTimes].push(jsonCache[photoUrl]);
    }
    // Keep only recent photos that have been POSSEd the less
    const candidates = photosPerTimes[minTimes];

    const photoToPosse =
      candidates[Math.floor(Math.random() * candidates.length)];

    try {
      const tootUrl = await createToot(photoToPosse);

      console.log(tootUrl);
      if (tootUrl.startsWith(process.env.MASTODON_INSTANCE)) {
        jsonCache[photoToPosse.url].toots.push(tootUrl);
        jsonTimestamp.timestamp = Date.now();
      }
    } catch (error) {
      return handleError(error);
    }
  };

  // TODO: use Promise.allSettled to continue even if one is rejected
  let result = await Promise.all(
    ["https://nicolas-hoizey.photo/feeds/mastodon/photos.json"].map(
      async (feedUrl) => {
        console.log(`Fetching ${feedUrl} …`);
        return fetch(feedUrl)
          .then((response) => response.json())
          .then(processFeed)
          .catch(handleError);
      }
    )
  );

  fs.writeFileSync(CACHE_FILE, JSON.stringify(jsonCache, null, 2), {
    encoding: "utf8",
  });
  fs.writeFileSync(TIMESTAMP_FILE, JSON.stringify(jsonTimestamp, null, 2), {
    encoding: "utf8",
  });

  // TODO: parse `result` to find potential errors and return accordingly
  // TODO: no need to return
  // return { statusCode: 200, body: JSON.stringify(result) };
};

main();

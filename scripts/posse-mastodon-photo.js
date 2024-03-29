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

// const MINUTES_BETWEEN_PHOTOS = 60 * 20; // 20 hours
const MINUTES_BETWEEN_PHOTOS = 1;

// const MINUTES_BETWEEN_SAME_TOOT = 60 * 24 * 90; // 90 days
const MINUTES_BETWEEN_SAME_TOOT = 1;

const main = async () => {
  // Helper Function to return unknown errors
  const handleError = (error) => {
    const code = Array.isArray(error) ? error[0].code : error.code;
    const msg = Array.isArray(error) ? error[0].message : error.message;
    process.exitCode = 1;
    // TODO: no need to return?
    return status(code, String(msg));
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
    const photosNotTootedRecently = {};

    // Iterate over feed items
    items.forEach((item, index) => {
      // Fill cache with new items
      // TODO: remove items from cache that are not anymore in the feed
      if (jsonCache.hasOwnProperty(item.url)) {
        const existingToots = [...jsonCache[item.url].toots];
        let lastTootTimestamp = jsonCache[item.url].lastTootTimestamp;
        // Initialize lastTootTimestamp for photos already with some toots
        if (lastTootTimestamp === undefined && existingToots.length > 0) {
          lastTootTimestamp = Date.now();
        }
        // Update item content
        jsonCache[item.url] = item;
        // Restore existing toots
        jsonCache[item.url].toots = existingToots;
        jsonCache[item.url].lastTootTimestamp = lastTootTimestamp;
      } else {
        // This is a new photo
        jsonCache[item.url] = item;
        jsonCache[item.url].toots = [];
      }
      // Fill candidates for toot
      if (
        jsonCache[item.url].lastTootTimestamp === undefined ||
        Date.now() <
          jsonCache[item.url].lastTootTimestamp +
            MINUTES_BETWEEN_SAME_TOOT * 60 * 1000
      ) {
        photosNotTootedRecently[item.url] = { ...jsonCache[item.url] };
      }
    });

    if (Object.keys(photosNotTootedRecently).length === 0) {
      return status(200, "No photo to toot");
    }

    // Get lowest number of toots for any photo
    let minTimes = -1;
    const photosPerTimes = {};
    for (const photoUrl in photosNotTootedRecently) {
      const photoTimes = photosNotTootedRecently[photoUrl].toots.length;
      minTimes = minTimes === -1 ? photoTimes : Math.min(minTimes, photoTimes);
      if (!photosPerTimes.hasOwnProperty(photoTimes)) {
        photosPerTimes[photoTimes] = [];
      }
      photosPerTimes[photoTimes].push(photosNotTootedRecently[photoUrl]);
    }

    // Keep only recent photos that have been POSSEd the less
    const candidates = photosPerTimes[minTimes];

    const photoToPosse =
      candidates[Math.floor(Math.random() * candidates.length)];

    try {
      console.log(`Trying to post toot "${photoToPosse.title}"`);
      const tootUrl = await createToot(photoToPosse);
      if (tootUrl?.startsWith(process.env.MASTODON_INSTANCE)) {
        console.log(`-> ${tootUrl}`);
        jsonCache[photoToPosse.url].toots.push(tootUrl);
        jsonCache[photoToPosse.url].lastTootTimestamp = Date.now();
        jsonTimestamp.timestamp = Date.now();
      }
    } catch (error) {
      return handleError(error);
    }
  };

  // Manage multiple feeds
  // TODO: use Promise.allSettled to continue even if one is rejected
  await Promise.all(
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
};

main();

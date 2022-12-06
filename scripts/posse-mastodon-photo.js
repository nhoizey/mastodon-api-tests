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
    photos.forEach((item, index) => {
      if (!jsonCache.hasOwnProperty(item.url)) {
        // This is a new photo
        jsonCache[item.url] = { times: 0 };
      }
    });

    // Sort cache per number of toots
    jsonCache.sort((a, b) => a.times - b.times);

    console.dir(jsonCache);

    // Keep only recent photos that have been POSSEd the less
    const minTimes = jsonCache[0].times;
    const candidates = jsonCache.filter((item) => item.times === minTimes);

    console.log("#####################################################");
    console.dir(candidates);

    if (candidates.length === 0) {
      // TODO: no need to return
      console.error("This should never happen");
      return status(200, "No item found to process.");
    }

    const photoToPosse =
      candidates[Math.floor(Math.random() * candidates.length)];
    try {
      // return createToot(photoToPosse);
    } catch (error) {
      return handleError(error);
    }
  };

  // TODO: use Promise.allSettled to continue even if one is rejected
  let result = await Promise.all(
    ["https://nicolas-hoizey.photos/feeds/mastodon/photos-test.json"].map(
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

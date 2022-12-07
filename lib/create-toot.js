// Values to put in environment variables
// MASTODON_INSTANCE: the root URL of the Mastodon instance you're using
// MASTODON_ACCESS_TOKEN: your access token, get it from /settings/applications/new

// Get environment variables
require("dotenv").config();

// Native Node modules
const path = require("node:path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

// Third party dependencies
const { login } = require("masto");

// Local dependencies
const download = require("../lib/download.js");

const TEMPORARY_DIRECTORY =
  process.env.RUNNER_TEMPORARY_DIRECTORY || os.tmpdir();

const createToot = async (item) => {
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

  try {
    // Connect to Mastodon
    const MastodonClient = await login({
      url: process.env.MASTODON_INSTANCE,
      accessToken: process.env.MASTODON_ACCESS_TOKEN,
    });

    // TODO: shorten the status text if it's too long, or let the API call fail (current behavior)
    let statusText = item.content_text;

    // Safeguard for test platform
    if (process.env.MASTODON_INSTANCE.match("mastodon.hsablonniere.com")) {
      statusText = statusText.replaceAll("@", "%");
    }
    let toot;

    console.log(`Posting toot "${item.title}"`);

    // Check if there's at least one image attachment
    if (item.hasOwnProperty("attachments") && item.attachments.length > 0) {
      let imagesAttachments = item.attachments.filter((attachment) =>
        // Only keep images
        attachment.mime_type.match("image/")
      );
      if (imagesAttachments.length > 0) {
        let uploadedImages = await Promise.all(
          imagesAttachments.map(async (attachment) => {
            let media;
            let imageFile = path.join(
              TEMPORARY_DIRECTORY,
              `image-${crypto.randomUUID()}`
            );
            try {
              // Download the image file
              await download(attachment.url, imageFile);

              try {
                media = await MastodonClient.mediaAttachments.create({
                  file: fs.createReadStream(imageFile),
                  description: attachment.title,
                });
                // Remove the temporary local copy
                await fs.unlink(imageFile, () => {
                  // console.log(`${imageFile} deleted.`);
                });
                return media.id;
              } catch (error) {
                handleError(error);
              }
            } catch (e) {
              handleError(e.message);
            }
          })
        );

        try {
          // Post the toot with the uploaded image(s)
          toot = await MastodonClient.statuses.create({
            status: statusText,
            visibility: "public",
            mediaIds: uploadedImages,
            language: item.lang,
          });
          return toot.uri;
        } catch (error) {
          return handleError(error);
        }
      }
    } else {
      // Simple text toot
      toot = await MastodonClient.statuses.create({
        status: statusText,
        visibility: "public",
        language: item.lang,
      });
    }
    return toot.uri;
  } catch (error) {
    // TODO: get the actual error from each call
    return handleError(error);
  }
};

module.exports = createToot;

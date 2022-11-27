// Values to put in environment variables:
// MASTODON_INSTANCE: the root URL of the Mastodon instance you're using
// MASTODON_ACCESS_TOKEN: your access token, get it from /settings/applications/new

// Native Node modules
const path = require("node:path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

// Third party dependencies
const dotenv = require("dotenv");
const { login } = require("masto");

// Local dependencies
const download = require("./download.js");

dotenv.config();

const TEMPORARY_FILE_DIR = os.tmpdir() || "/tmp/";

const JSON_FEED_ITEM = {
  id: "https://nicolas-hoizey.com/notes/2022/11/26/1/",
  url: "https://nicolas-hoizey.com/notes/2022/11/26/1/",
  lang: "en",
  title: "💬 Note from 26 November 2022, 01:01",
  date_published: "2022-11-26T00:01:00Z",
  content_text:
    "My notes will now be push to Mastodon as toots, this feels great! 🎉\n\n⚓️ https://nicolas-hoizey.com/notes/2022/11/26/1/",
  attachments: [
    {
      url: "https://nicolas-hoizey.com/notes/2022/11/26/1/screenshot-mastodon-toot-from-my-own-site.png",
      mime_type: "image/png",
      title:
        'A screenshot of a toot where the application used to publish is "nicolas-hoizey.com"',
    },
    {
      url: "https://image.thum.io/get/width/1200/crop/800/noanimate/https://mxb.dev/blog/the-indieweb-for-everyone/",
      mime_type: "image/png",
      title: "Screenshot of The IndieWeb for Everyone",
    },
  ],
};

const main = async () => {
  const MastodonClient = await login({
    url: process.env.MASTODON_INSTANCE,
    accessToken: process.env.MASTODON_ACCESS_TOKEN,
  });

  try {
    let uploadedImages = await Promise.all(
      JSON_FEED_ITEM.attachments.map(async (attachment) => {
        let media;
        let imageFile = path.join(
          TEMPORARY_FILE_DIR,
          `image-${crypto.randomUUID()}`
        );
        try {
          await download(attachment.url, imageFile);
          // console.log("Download done");
          try {
            media = await MastodonClient.mediaAttachments.create({
              file: fs.createReadStream(imageFile),
              description: attachment.title,
            });
            console.log(`Uploaded with ID ${media.id}`);
            await fs.unlink(imageFile, () => {
              // console.log(`${imageFile} deleted.`);
            });
            return media.id;
          } catch (error) {
            console.log(error);
          }
        } catch (e) {
          // console.log("Download failed");
          console.log(e.message);
        }
      })
    );
    console.dir(uploadedImages);

    // Post the toot with the uploaded image(s)
    console.log(`Post message: ${JSON_FEED_ITEM.title}`);
    let toot = await MastodonClient.statuses.create({
      status: JSON_FEED_ITEM.content_text,
      visibility: "public",
      mediaIds: uploadedImages,
      language: JSON_FEED_ITEM.lang,
    });
    if (toot) {
      console.log(
        `"${JSON_FEED_ITEM.title}" successfully posted to Mastodon: ${toot.uri}`
      );
    } else {
      console.log("Error posting to Mastodon API.");
    }
  } catch (error) {
    console.dir(error);
  }
};

main();

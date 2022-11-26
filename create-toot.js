// Values to put in environment variables:
// MASTODON_INSTANCE: the root URL of the Mastodon instance you're using
// MASTODON_ACCESS_TOKEN: your access token, get it from /settings/applications/new

const dotenv = require("dotenv");
const { login } = require("masto");

const bent = require("bent");
const getBuffer = bent("buffer");

dotenv.config();

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
  ],
};

const main = async () => {
  const MastodonClient = await login({
    url: process.env.MASTODON_INSTANCE,
    accessToken: process.env.MASTODON_ACCESS_TOKEN,
  });

  try {
    let toot;

    let uploadedImages = await Promise.all(
      JSON_FEED_ITEM.attachments.map(async (attachment) => {
        let imageBuffer;
        let imageData;
        try {
          console.log(`Upload ${attachment.url}`);
          imageBuffer = await getBuffer(attachment.url);
          imageData = await imageBuffer.toString("base64");
        } catch (error) {
          console.dir(error);
        }

        let media;
        try {
          media = await MastodonClient.mediaAttachments.create({
            file: imageData,
            description: attachment.title,
          });
          console.log(`Uploaded with ID ${media.id}`);
          return media.id;
        } catch (error) {
          console.log(error);
        }
      })
    );
    console.dir(uploadedImages);

    // Post the toot with the uploaded image(s)
    console.log(`Post message: ${JSON_FEED_ITEM.title}`);
    toot = await MastodonClient.statuses.create({
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

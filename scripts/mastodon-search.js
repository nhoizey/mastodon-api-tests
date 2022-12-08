const dotenv = require("dotenv");
const { login } = require("masto");

dotenv.config();

const URL_TO_FIND =
  "https://nicolas-hoizey.com/links/2022/10/18/the-proprietary-syndication-formats/";

const main = async () => {
  const MastodonClient = await login({
    url: process.env.MASTODON_INSTANCE,
    accessToken: process.env.MASTODON_ACCESS_TOKEN,
  });

  let nb = 0;
  try {
    const search = await MastodonClient.search({
      type: "statuses",
      accountId: `${process.env.MASTODON_ID}`,
      q: encodeURIComponent(URL_TO_FIND.replace("https://", "")),
    });
    if (search) {
      for await (const results of search) {
        const matches = results.statuses.filter(
          (status) => status.card?.url === URL_TO_FIND
        );
        nb += matches.length;
      }
    }
  } catch (error) {
    console.dir(error);
  }
  console.log(nb);
};

main();

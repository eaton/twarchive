import { PartialTweet, TwitterArchive } from "twitter-archive-reader";
import { Tweet } from "./tweet.js";

export function getTweetUrl(tweet: PartialTweet) {
  let id = '';
  let user = 'twitter';

  if (tweet instanceof Tweet) {
    id = tweet.id;
    user = tweet.user.handle;
  } else {
    id = tweet.id_str;
    user = tweet.user.screen_name;
  }
  return `https://twitter.com/${user}/status/${id}`;
}

export async function loadTwitterArchive(path = 'twitter.zip') {
  const archive = new TwitterArchive(path);
  return archive.ready()
    .then(() => {
      archive.releaseZip();
      return archive;
    });
}

type TwitterOembedResponse = Record<string, unknown> & {
  url: string,
  author_name: string,
  author_url: string,
  html: string,
}

/**
 * Used the oEmbed endpoint to grab data from the oEmbed endpoint. This is useful
 * when iterating favorites, since they're stored as generic `i/web/status` urls.
 */
export async function getOembedData(id: string) {
  const url = new URL('https://publish.twitter.com/oembed');
  url.searchParams.set('url', `https://twitter.com/twitter/status/${id}`);

  const data = {
    url: `https://twitter.com/twitter/status/${id}`,
    name: '',
    screen_name: '',
    date: new Date(0),
    error: false,
    deleted: false
  }

  return fetch(url)
    .then(resp => {
      if (resp.status === 404) data.deleted = true;
      return resp.json();
    })
    .then(json => {
      const raw = (json as TwitterOembedResponse);
      data.url = raw.url;
      data.name = raw.author_name;
      data.screen_name = raw.author_url?.split('/').pop() ?? '';
      let rawDate = /([a-zA-Z0-9, ]*)<\/a><\/blockquote>/.exec(raw.html)?.[0] ?? '';
      if (rawDate !== '') {
        rawDate = rawDate.split('<')[0];
        data.date = new Date(rawDate);
      }
      return data;
    })
    .catch(error => {
      data.error = true;
      return data;
    });
}
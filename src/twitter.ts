import TwitterArchive from 'twitter-archive-reader';
import { loadTwitterArchive } from './twitter/util.js';
import { Favorite } from './twitter/favorite.js';
import * as csv from 'fast-csv';

import matter from 'gray-matter';
const { stringify: formatFrontMatter } = matter;

import fse from 'fs-extra';
import { Tweet } from './twitter/tweet.js';
const { ensureDir, createWriteStream, writeFile } = fse;

await outputFullArchive();

export async function outputFullArchive(zipfile = 'twitter.zip') {
  const archive = await loadTwitterArchive(zipfile);
  // await outputFavorites(archive);
  await outputTweets(archive);
}

export async function outputFollowers(archive: TwitterArchive) {
  return Promise.resolve();
}

export async function outputFollowing(archive: TwitterArchive) {
  return Promise.resolve();
}

interface OutputTweetOptions {
  filter?: (tweet: Tweet) => boolean;
  singles?: boolean;
  threads?: boolean;
  replies?: boolean;
  retweets?: boolean;
  format?: 'markdown' | 'html' | 'json';
}

export async function outputTweets(archive: TwitterArchive, options?: OutputTweetOptions) {
  const threaded = Tweet.buildThreads(archive);
  const opts = options ?? {
    threads: true,
    format: 'markdown'
  };

  let dir = '';
  for (const tweet of threaded) {

    if (opts.filter) {
      if (opts.filter(tweet) === false) continue;
    }

    if (tweet.isSelfReply) {
      continue;
    } else if (tweet.isRetweet) {
      if (opts.retweets) {
        dir = 'retweet';
      } else {
        continue;
      }
    } else if (tweet.isOtherReply) {
      if (opts.replies) {
        dir = 'reply';
      } else {
        continue;
      }
    } else if (tweet.isThread) {
      if (opts.threads) {
        dir = 'thread'
      } else {
        continue;
      }
    } else {
      if (opts.singles) {
        dir = 'single'
      } else {
        continue;
      }
    }

    const frontMatter: Record<string, unknown> = {
      date: tweet.date,
      layout: `twitter_${dir}`,
      canonical: tweet.url,
      favorites: tweet.thread?.favorites ?? tweet.favorites,
      retweets: tweet.thread?.retweets ?? tweet.retweets,
    }

    const hashtags = tweet.thread?.hashtags ?? tweet.hashtags;
    const links = tweet.thread?.links ?? tweet.links;
    const mentions = tweet.thread?.mentions ?? tweet.mentions;

    if (hashtags.length) frontMatter['tags'] = hashtags;
    if (Object.entries(links).length) frontMatter['links'] = Object.values(links);
    if (Object.entries(mentions).length) frontMatter['mentions'] = Object.keys(mentions);

    if (tweet.isThread) {
      frontMatter['tweets'] = tweet.thread?.tweets.length;
    }

    if (tweet.isReply) {
      frontMatter['inReplyTo'] = `https://twitter.com/${tweet.inReplyTo?.handle ?? 'twitter'}/status/${tweet.inReplyTo?.id}`;
    }

    await ensureDir(`output/twitter/${dir}/${tweet.date.getFullYear()}`);
    await writeFile(
      `output/twitter/${dir}/${tweet.date.getFullYear()}/${tweet.date.toISOString().split('T')[0]}-${tweet.id}.md`,
      formatFrontMatter(tweet.thread?.format() ?? tweet.format(), frontMatter)
    );
  }
}

export async function outputFavorites(archive: TwitterArchive, includeRestricted = false) {
  await ensureDir(`output/twitter`);

  const stream = csv.format({
    objectMode: true,
    headers: true,
    quote: false,
    quoteHeaders: false,
    delimiter: '\t',
  });
  stream.pipe(createWriteStream(`output/twitter/favorites.tsv`));

  console.log(`Processing ${archive.favorites.length} favorites`);

  for (const f of archive.favorites) {
    const fav = new Favorite(f);
    if (fav.deleted || fav.isSuspended) continue;
    if (fav.isRestricted && includeRestricted === false) continue;

    await fav.populate();
    stream.write({
      id: fav.id,
      created: fav.tweetDate?.toISOString().split('T')[0],
      faved: fav.date?.toISOString().split('T')[0],
      user: fav.handle,
      text: fav.text?.replaceAll('\n', '\\n')
    });
  }

  stream.end();
  return Promise.resolve();
}
import TwitterArchive, { MediaGDPREntity } from 'twitter-archive-reader';
import { loadTwitterArchive } from './twitter/util.js';

import matter from 'gray-matter';
const { stringify: formatFrontMatter } = matter;

import fse from 'fs-extra';
import { Thread, Tweet } from './twitter/tweet.js';
import path from 'path';
import { findTopics } from './shared/extract.js';
const { ensureDir, writeFile } = fse;

await outputFullArchive();

export async function outputFullArchive(zipfile = 'input/twitter.zip') {
  const archive = await loadTwitterArchive(zipfile);
  // await outputFavorites(archive);
  await outputTweets(archive, {
    filter: tweet => {
      if (tweet.isRetweet) return false;
      if (tweet.isReply)return false;
      if (tweet.thread) {
        return (
          tweet.thread.tweets.length > 2 ||
          tweet.thread.favorites > 200 ||
          tweet.thread.retweets > 50
        );
      } else {
        return (tweet.favorites > 100 || tweet.retweets > 25);
      }
    }
  });
}

export async function outputFollowers(archive: TwitterArchive) {
  return Promise.resolve();
}

export async function outputFollowing(archive: TwitterArchive) {
  return Promise.resolve();
}

interface OutputTweetOptions {
  filter?: (tweet: Tweet) => boolean;
  format?: 'markdown' | 'html' | 'json';
}

export async function outputTweets(archive: TwitterArchive, options?: OutputTweetOptions) {
  const threaded = Tweet.buildThreads(archive);
  const opts = {
    format: 'markdown',
    ...options
  };

  let dir = '';
  for (const tweet of threaded) {

    if (opts.filter) {
      if (opts.filter(tweet) === false) continue;
    }

    if (tweet.isSelfReply) {
      continue;
    } else if (tweet.isRetweet) {
      dir = 'retweet';
    } else if (tweet.isOtherReply) {
      dir = 'reply';
    } else if (tweet.isThread) {
      dir = 'thread'
    } else {
      dir = 'single'
    }

    if (tweet.isThread) {
      for (const t of tweet.thread?.tweets ?? []) {
        await saveMediaFiles(t, archive);
      }
    } else {
      await saveMediaFiles(tweet, archive);
    }

    const frontMatter: Record<string, unknown> = {
      date: tweet.date,
      id: tweet.id,
      layout: `tweet.njk`,
      source: tweet.url,
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

    findTopics(tweet.raw);

    await ensureDir(`output/twitter/${dir}/${tweet.date.getFullYear()}`);
    await writeFile(
      `output/twitter/${dir}/${tweet.date.getFullYear()}/${tweet.date.toISOString().split('T')[0]}-${tweet.id}.md`,
      formatFrontMatter(tweet.thread?.format() ?? tweet.format(), frontMatter)
    );
  }
}

export function getMediaFilename(entity: MediaGDPREntity) {
  let filename = `${entity.id_str}-${entity.media_url_https.split('/').pop()}`;
  if (entity.type !== 'photo') {
    filename = [...filename.split('.').slice(0, -1), 'mp4'].join('.');
  }
  return filename;
}

export async function saveMediaFiles(tweet: Tweet, archive: TwitterArchive, dir = 'output/twitter/media') {
  await ensureDir(dir);
  for (const media of Object.values(tweet.media)) {
    await archive.medias.fromTweetMediaEntity(media, true)
      .then(ab => writeFile(
        path.join(dir, getMediaFilename(media)),
        Buffer.from(ab as ArrayBuffer))
      );
    }
}

export async function screenshotTweet(url: string, dir = 'output/twitter/screenshots' ) {
  // do nothing
}

export function formatTweet(tweet: Tweet): string[] {
  const output: string[] = [];
  let mainText = tweet.raw ?? '';

  for (const lookup of Object.entries(tweet.links)) {
    mainText = mainText.replaceAll(lookup[0], lookup[1]);
  }

  // Link media link the media files
  for (const [key, media] of Object.entries(tweet.media)) {
    mainText = mainText.replaceAll(key, '');
    output.push(media.media_url_https);
    if (media.media_alt) output.push(media.media_alt)
  }

  return output;
}

export function formatThread(thread: Thread) {
  
}

export function makeAttrSafe(text: string) {
  return text.replaceAll("\n", "&#13;");
}
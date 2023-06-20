import TwitterArchive from 'twitter-archive-reader';
import { groupThreads, loadTwitterArchive } from './twitter/util.js';
import { Favorite } from './twitter/favorite.js';
import * as csv from 'fast-csv';

import matter from 'gray-matter';
const { stringify: formatFrontMatter } = matter;

import fse from 'fs-extra';
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

export async function outputTweets(archive: TwitterArchive) {
  const roots = groupThreads(archive);

  let dir = '';
  for (const thread of roots) {
    if (thread.isReply) {
      // Replies get treated as replies, even if they're threads.
      dir = 'replies'
    } else if (thread.isSelfReply) {
      dir = 'threads'
    } else {
      dir = 'singles'
    }

    const frontMatter: Record<string, unknown> = {
      date: thread.date.toISOString(),
      layout: `twitter_${dir}`,
      canonical: thread.canonical,
      tweets: thread.tweets.length,
      favorites: thread.favorites,
      retweets: thread.retweets,
    }

    if (thread.hashtags.length) frontMatter['tags'] = thread.hashtags;
    if (thread.links.length) frontMatter['links'] = thread.links;
    if (thread.mentions.length) frontMatter['mentions'] = thread.mentions;

    if (thread.isReply) {
      frontMatter['inReplyTo'] = `https://twitter.com/twitter/status/${thread.tweets[0].inReplyTo?.id}`;
    }

    await ensureDir(`output/twitter/${dir}/${thread.date.getFullYear()}`);
    await writeFile(
      `output/twitter/${dir}/${thread.date.getFullYear()}/${thread.date.toISOString().split('T')[0]}.md`,
      formatFrontMatter(thread.format(), frontMatter)
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
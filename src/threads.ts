import { PartialTweet, TwitterArchive } from 'twitter-archive-reader';
import { Thread } from './index.js';
import pkg, { ensureDir } from 'fs-extra';
const { writeFile } = pkg;

await outputThreads();

export async function outputThreads(zipfile = 'twitter.zip') {
  const archive = new TwitterArchive(zipfile, {
    // All we care about are favs and tweets
    ignore: ['ad', 'dm', 'follower', 'following', 'block', 'list', 'mute', 'moment']
  });

  archive.events.on('zipready', () => {
    console.log("Zip loaded...");
  });
  archive.events.on('tweetsread', () => {
    console.log("Tweets read...");
  });
  
  await archive.ready();

  archive.releaseZip();

  // First, find all the replies to other people
  const roots: Record<string, Thread> = {};
  for (const t of archive.tweets.sortedIterator('asc')) {
    if (roots[t.id_str]) continue; // We've already popped this into threads list
    const parent = findRoot(t, archive);
    if (roots[parent.id_str] === undefined) {
      roots[parent.id_str] = new Thread(parent);
    }
    if (t.id_str !== parent.id_str) roots[parent.id_str].tweets.push(t);
  }

  const threads: Record<string, Thread> = {};
  for (const thread of Object.values(roots)) {
    if (thread.tweets.length > 1 && thread.tweets[0].in_reply_to_screen_name === undefined) {
      threads[thread.root_id] = thread;
    }
  }

  for (const thread of Object.values(threads)) {
    const t = {
      link: thread.canonical,
      date: new Date(thread.start),
      text: thread.format(),
      length: thread.tweets.length,
      favorites: thread.favorites,
      retweets: thread.retweets
    }
    await ensureDir(`cache/threads/${t.date.getFullYear()}`);
    const path = `cache/threads/${t.date.getFullYear()}/${thread.root_id}.md`;
    await writeFile(path, t.text);
  }
}

function findRoot(tweet: PartialTweet, archive: TwitterArchive) {
  if (tweet.in_reply_to_status_id_str) {
    const parent = archive.tweets.single(tweet.in_reply_to_status_id_str) ?? undefined;
    if (parent) return findRoot(parent, archive);
  }
  return tweet;
}
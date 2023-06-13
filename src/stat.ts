import { PartialTweet, TwitterArchive } from 'twitter-archive-reader';

await zipStats();


type TweetClusters = {
  roots: PartialTweet[],
  threads: Record<string, TweetThread>
}

type TweetThread = {
  date: string,
  tweets: PartialTweet[],
  favorites?: number,
  retweets?: number,
  text?: string,
}

export async function zipStats(zipfile = 'twitter.zip') {
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

  const data: TweetClusters = {
    roots: archive.tweets.all.filter(tweet => tweet.user.screen_name === 'eaton' && tweet.in_reply_to_status_id_str === undefined),
    threads: {}
  };

  for(const parent of data.roots) {
    const children = getChildren(archive, [parent]);
    if (children.length) {
      data.threads[parent.id_str] = {
        date: parent.created_at,
        tweets: [parent, ...children]
      };
      console.log(`${parent.created_at} - ${data.threads[parent.id_str].tweets.length} tweet thread`);
    }
  }
}

export function getChildren(archive: TwitterArchive, tweets: PartialTweet[]): PartialTweet[] {
  const ids = tweets.map(tweet => tweet.id_str);
  const children = archive.tweets.all.filter(tweet => ids.includes(tweet.in_reply_to_status_id_str ?? ''));
  if (children.length === 0) return [];
  return [...children, ...getChildren(archive, children)];
}

export function getRoot(archive: TwitterArchive, tweet: PartialTweet) {
  if (tweet.in_reply_to_status_id_str === undefined) return tweet;
  const parent = archive.tweets.single(tweet.in_reply_to_status_id_str) ?? undefined;
  if (parent) return getRoot(archive, parent);
  return undefined;
}
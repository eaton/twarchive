import { TwitterArchive } from 'twitter-archive-reader';

await zipStats();

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

  console.log({
    handle: archive.user.screen_name,
    name: archive.user.name,
    email: archive.user.email_address,
    bio: archive.user.bio
  });

  console.log(archive.info.archive)

  console.log(
    archive.tweets.sortedIterator("desc").next()
  );
}
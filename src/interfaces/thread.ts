import { PartialTweet } from "twitter-archive-reader";

/**
 * Helper class that wraps multi-tweet threads, aggregates their stats, and can produce
 * formatted versions of their text without twitter URL-shortener cruft.
 */
export class Thread {
  root_id: string;
  tweets: PartialTweet[] = [];
  slug: string = '';

  constructor(tweet: PartialTweet) {
    this.root_id = tweet.id_str;
    this.tweets.push(tweet);
  }

  get canonical() {
    return `https://twitter.com/${this.tweets[0].user.screen_name}/status/${this.tweets[0].id_str}`;
  }

  get start() {
    return this.tweets.sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at;
  }

  get end() {
    return this.tweets.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at;
  }

  get retweets() {
    let rts = 0;
    for (const t of this.tweets) {
      rts += t.retweet_count ?? 0;
    }
    return rts;
  }

  get favorites() {
    let favs = 0;
    for (const t of this.tweets) {
      favs += t.favorite_count ?? 0;
    }
    return favs;
  }

  format() {
    return this.tweets.map(this.formatTweet).join('\n\n');
  }

  private formatTweet(tweet: PartialTweet) {
    let text = tweet.text;
    for (const url of tweet.entities.urls) {
      text = text.replaceAll(url.url, url.expanded_url);
    }
    return text;
  }
}
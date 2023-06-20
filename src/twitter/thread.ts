import { PartialTweet } from "twitter-archive-reader";
import { TweetFormattingOptions, Tweet } from "./tweet.js";

export interface ThreadFormattingOptions extends TweetFormattingOptions {
  consolidateMentions?: boolean,
  consolidateHashtags?: boolean,
  linkIndividualTweets?: boolean,
}

/**
 * Helper class that wraps single and multi-tweet threads into a single entity; this allows us
 * to quickly generate output files for full threads, standalone tweets, and so on without any
 * special processing in the calling code.
 */
export class Thread extends Tweet {
  replies: Tweet[] = [];
  
  add(tweet: PartialTweet | Tweet) {
    if (tweet instanceof Tweet) {
      this.replies.push(tweet);
    } else {
      this.replies.push(new Tweet(tweet));
    }
  }

  get tweets(): Tweet[] {
    return [this, ...this.replies];
  }

  override get retweets() {
    return super.retweets + this.replies.map(t => t.retweets).reduce((p, c) => p + c)
  }

  override get favorites() {
    return super.favorites + this.replies.map(t => t.favorites).reduce((p, c) => p + c)
  }

  override format(options: ThreadFormattingOptions = {}) {
    const opt: ThreadFormattingOptions = {
      consolidateMentions: true,
      consolidateHashtags: true,
      linkIndividualTweets: false,
      delimiter: '\n\n',
      ...options,
    };
    
    return this.tweets.map(tweet => tweet.format(opt)).join(opt.delimiter);
  }
}


import { MediaGDPREntity, PartialTweet, PartialTweetEntity, PartialTweetMediaEntity, TwitterArchive, TwitterHelpers } from "twitter-archive-reader";
import { TwitterAccount } from "./twitter-account.js";

export type TweetHashtag = PartialTweetEntity['hashtags'];
export type TweetUserMention = PartialTweetEntity['user_mentions'];
export type TweetUrl = PartialTweetEntity['urls'];
export type TweetMedia = PartialTweetMediaEntity | MediaGDPREntity;
export type TweetEntity = TweetHashtag | TweetUserMention | TweetUrl | TweetMedia;

/**
 * Options for processing embedded media, links, hashtags, and so on.
 * 
 * - ignore: leave the item as is
 * - strip:  remove the item from the tweet text
 * - expand: replace the item with its expanded text (name, full URL, etc)
 * - link:   replace the item with an HTML or markdown link (also expands urls)
 * - embed:  replace the item with HTML or markdown embed code, if possible (also expands urls)
 */
export type TweetEmbedFormatOption = 'ignore' | 'strip' | 'expand' | 'link' | 'embed';

export interface TweetFormattingOptions {
  hashtags?: TweetEmbedFormatOption,
  urls?: TweetEmbedFormatOption,
  trailingUrls?: TweetEmbedFormatOption,
  mentions?: TweetEmbedFormatOption,
  leadingMentions?: TweetEmbedFormatOption,
  media?: TweetEmbedFormatOption,
  delimiter?: string,
}

export class Tweet {
  protected _user?: TwitterAccount;
  protected _links?: Record<string, string>;
  protected _replies: Tweet[] = [];
  protected _thread?: Thread;

  static buildThreads(archive: TwitterArchive) {
    const tweets: Record<string, Tweet> = {};
    for (const pt of archive.tweets.sortedIterator('asc')) {
      const tweet = new Tweet(pt, archive);
      tweets[tweet.id] = tweet;
      if (tweet.inReplyTo.id && tweets[tweet.inReplyTo.id]) {
        tweets[tweet.inReplyTo.id].addReply(tweet);
      }
    }
    return Object.values(tweets);
  }

  constructor(protected _tweet: PartialTweet, protected archive?: TwitterArchive) { }

  get id() {
    return this._tweet.id_str;
  }

  get url() {
    return `https://twitter.com/${this.user.handle}/status/${this.id}`;
  }

  get date() {
    return TwitterHelpers.dateFromTweet(this._tweet);
  }

  /*
   * Thread checks and handling
   */
  get isThread() {
    return this._replies.length > 0;
  }

  get thread() {
    if (this.isThread) {
      if (this._thread === undefined) {
        this._thread = new Thread([this as Tweet, ...this.getReplies(true)]);
      }
    }
    return this._thread;
  }

  getReplies(getDescendents = true) {
    const replies: Tweet[] = [];
    for (const t of this._replies) {
      replies.push(t);
      if (getDescendents) replies.push(...t.getReplies(getDescendents));
    }
    return replies;
  }

  addReply(tweet: Tweet | PartialTweet) {
    if (tweet instanceof Tweet) {
      this._replies.push(tweet);
    } else {
      this._replies.push(new Tweet(tweet));
    }
  }

  /*
   * Reply handling and inferred metadata
   */
  get isReply() {
    return !!this._tweet.in_reply_to_status_id_str;
  }

  get isSelfReply() {
    return this._tweet.in_reply_to_user_id_str === this._tweet.user.id_str;
  }

  get isOtherReply() {
    return (this.isReply && !this.isSelfReply);
  }

  get inReplyTo() {
    if (this._tweet.in_reply_to_status_id_str) {
      return {
        id: this._tweet.in_reply_to_status_id_str,
        handle: this._tweet.in_reply_to_screen_name,
        user_id: this._tweet.in_reply_to_user_id_str
      }
    } else {
      return {};
    }
  }

  get isRetweet() {
    return (this._tweet.retweeted_status || this._tweet.text.startsWith("RT @"));
  }

  get hasMedia() {
    return TwitterHelpers.isWithMedia(this._tweet);
  }

  get hasVideo() {
    return TwitterHelpers.isWithVideo(this._tweet);
  }

  get user() {
    if (this._user === undefined) {
      this._user = new TwitterAccount(this._tweet.user);
      if (this.archive && this._user.id === this.archive.user.id) {
        
      }
    }
    return this._user;
  }

  get handle() {
    return this.user.handle;
  }

  get raw() {
    return this._tweet.full_text ?? '';
  }

  get hashtags() {
    const tags = new Set<string>();
    for (const item of this._tweet.entities.hashtags) {
      tags.add(item.text);
    }
    return [...tags.values()];
  }

  get links() {
    if (this._links === undefined) {
      this._links = {};
      for (const item of this._tweet.entities.urls) {
        this._links[item.url] = item.expanded_url;
      }  
    }
    return this._links;
  }

  get mentions() {
    const mentions: Record<string, string> = {};
    for (const item of this._tweet.entities.user_mentions) {
      mentions[item.screen_name] = item.name;
    }
    return mentions;
  }

  get media() {
    const result: Record<string, MediaGDPREntity> = {};
    for (const item of this._tweet.extended_entities?.media ?? []) {
      result[item.url] = item;
    }
    return result;
  }

  get retweets() {
    return this._tweet.retweet_count ?? 0;
  }

  get favorites() {
    return this._tweet.favorite_count ?? 0;
  }

  get favorited() {
    return this._tweet.favorited ?? false;
  }

  format(options: TweetFormattingOptions = {}) {
    const opt: TweetFormattingOptions = {
      hashtags: 'link',
      urls: 'expand',
      mentions: 'link',
      media: 'expand',
      delimiter: '\n\n',
      ...options
    };

    const extras: string[] = [];
    let mainText = this._tweet.full_text ?? '';

    for (const lookup of Object.entries(this.links)) {
      mainText = mainText.replaceAll(lookup[0], lookup[1]);
    }

    // Link media link the media files 
    for (const [key, media] of Object.entries(this.media)) {
      mainText = mainText.replaceAll(key, '');
      extras.push(media.media_url_https);
      if (media.media_alt) extras.push(media.media_alt)
    }

    return [mainText, ...extras].join(opt.delimiter);
  }
}

export class Thread {
  constructor(public readonly tweets: Tweet[]) {}

  get length() {
    return this.tweets.length;
  }

  get start() {
    return this.tweets[0].date;
  }

  get end() {
    return new Date(this.tweets.map(t => t.date.valueOf())[0]);
  }

  get retweets() {
    return this.tweets
      .map(t => t.retweets)
      .reduce((p, c) => p + c, 0);
  }

  get favorites() {
    return this.tweets
      .map(t => t.favorites)
      .reduce((p, c) => p + c, 0);
  }

  get hashtags() {
    return [...new Set<string>(this.tweets.flatMap(t => t.hashtags))];
  }

  get links() {
    let output: Record<string, string> = {};
    for (const t of this.tweets) {
      output = {
        ...output,
        ...t.links
      }
    }
    return output;
  }

  get mentions() {
    let output: Record<string, string> = {};
    for (const t of this.tweets) {
      output = {
        ...output,
        ...t.mentions
      }
    }
    return output;
  }

  format() {
    return [...this.tweets.map(tweet => tweet.format())].join('\n\n');
  }
}

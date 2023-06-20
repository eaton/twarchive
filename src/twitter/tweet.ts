import { MediaGDPREntity, PartialTweet, PartialTweetEntity, PartialTweetMediaEntity, TwitterArchive, TwitterHelpers } from "twitter-archive-reader";
import { TwitterAccount } from "./twitter-account.js";
import { getTweetUrl } from "./util.js";

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
 * - link:   replace the shortened URL with an HTML or markdown link
 * - embed:  replace the shortened URL with HTML or markdown embed code, if possible
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
  protected userAccount?: TwitterAccount;

  constructor(protected tweet: PartialTweet, protected archive?: TwitterArchive) { }

  get id() {
    return this.tweet.id_str;
  }

  get canonical() {
    return getTweetUrl(this.tweet);
  }

  get date() {
    return TwitterHelpers.dateFromTweet(this.tweet);
  }

  get isReply() {
    return !!this.tweet.in_reply_to_status_id_str;
  }

  get isSelfReply() {
    return this.tweet.in_reply_to_user_id_str === this.tweet.id_str;
  }

  get hasMedia() {
    return TwitterHelpers.isWithMedia(this.tweet);
  }

  get hasVideo() {
    return TwitterHelpers.isWithVideo(this.tweet);
  }

  get inReplyTo() {
    if (this.tweet.in_reply_to_status_id_str) {
      return {
        id: this.tweet.in_reply_to_status_id_str,
        handle: this.tweet.in_reply_to_screen_name,
        user_id: this.tweet.in_reply_to_user_id_str
      }
    } else {
      return undefined;
    }
  }

  get user() {
    if (this.userAccount === undefined) {
      this.userAccount = new TwitterAccount(this.tweet.user);
      if (this.archive && this.userAccount.id === this.archive.user.id) {
        
      }
    }
    return this.userAccount;
  }

  get handle() {
    return this.user.handle;
  }

  get raw() {
    return this.tweet.full_text ?? '';
  }

  get hashtags() {
    const tags = new Set<string>();
    for (const item of this.tweet.entities.hashtags) {
      tags.add(item.text);
    }
    return [...tags.values()];
  }

  get links() {
    const links: Record<string, string> = {};
    for (const item of this.tweet.entities.urls) {
      links[item.url] = item.expanded_url;
    }
    return links;
  }

  get mentions() {
    const mentions: Record<string, string> = {};
    for (const item of this.tweet.entities.user_mentions) {
      mentions[item.screen_name] = item.name;
    }
    return mentions;
  }

  get media() {
    const result: Record<string, MediaGDPREntity> = {};
    for (const item of this.tweet.extended_entities?.media ?? []) {
      result[item.url] = item;
    }
    return result;
  }

  get retweets() {
    return this.tweet.retweet_count ?? 0;
  }

  get favorites() {
    return this.tweet.favorite_count ?? 0;
  }

  get favorited() {
    return this.tweet.favorited ?? false;
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
    let mainText = this.tweet.full_text ?? '';
    
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


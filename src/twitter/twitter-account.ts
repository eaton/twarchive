import { PartialTweetUser, TwitterHelpers, TwitterUserDetails } from "twitter-archive-reader";

export interface TwitterAccountInfo {
  handle: string;
  id?: string;  
  display?: string;
  protected?: boolean;
  verified?: boolean;
  avatar?: string;
  bio?: string;
  location?: string;
  homePage?: string;
  createdAt?: string
}

export class TwitterAccount {
  handle: string;
  id?: string;  
  display?: string;

  protected?: boolean;
  verified?: boolean;

  avatar?: string;
  bio?: string;
  location?: string;
  homePage?: string;
  createdAt?: string

  protected populated = false;

  static async prepopulate(user: PartialTweetUser | TwitterUserDetails | TwitterAccountInfo | string) {
    const u = new TwitterAccount(user);
    return u.populate();
  }

  constructor(user: PartialTweetUser | TwitterUserDetails | TwitterAccountInfo | string) {
    if (typeof user === 'string') {
      this.handle = user;

    } else if ('handle' in user) {
      // We have a TwitterAccountInfo
      this.handle = user.handle;
      this.id = user.handle;
      this.display = user.handle;
      this.protected = user.protected ?? false;
      this.verified = user.verified ?? false;
      this.avatar = user.avatar;

    } else if ('id_str' in user) {
      // We have a PartialTweetUser
      this.handle = user.screen_name;
      this.id = user.id_str;
      this.display = user.name;
      this.protected = user.protected;
      this.verified = user.verified;
      this.avatar = user.profile_image_url_https;

    } else {
      // We have a TwitterUserDetails
      this.handle = user.screen_name;
      this.id = user.id;
      this.display = user.full_name;
      this.avatar = user.profile_image_url_https;

      this.bio = user.bio;
      this.location = user.location;
      this.homePage = user.url;
      this.createdAt = user.created_at;
    }
  }

  /**
   * Populates all available user account data 
   */
  async populate(force = false) {
    if (!this.populated || force) {
      // Use `got` to ping twitter and cache the data. In the case of an error, populate with default values.
      
      this.populated = true;
    }
    return this;
  }

  get date() {
    if (this.createdAt) {
      return TwitterHelpers.parseTwitterDate(this.createdAt);
    }
    return undefined;
  }

  get canonical() {
    return `https://twitter.com/${this.handle}`;
  }
}
import { PartialFavorite, TwitterHelpers } from "twitter-archive-reader";
import { getOembedData } from "./util.js";
import { unwrapUrl } from "../util.js";

export class Favorite {
  tweetDate?: Date;
  handle?: string;
  displayName?: string;
  expanded?: string;
  deleted = false;
  protected populated = false;

  static async fromPartial(favorite: PartialFavorite) {
    const fav = new Favorite(favorite);
    return fav.populate();
  }

  constructor(protected favorite: PartialFavorite) {};

  get id() {
    return this.favorite.tweetId;
  }

  get date() {
    return TwitterHelpers.dateFromFavorite(this.favorite);
  }

  get canonical() {
    return (this.handle) ? `https://twitter.com/${this.handle}/status/${this.id}` : this.favorite.expandedUrl;
  }

  get raw() {
    return this.favorite.fullText;
  }

  get text() {
    return this.expanded ?? this.favorite.fullText;
  }

  get isRestricted() {
    return this.text?.trim().endsWith("limits who can view their Tweets. {learnmore}");
  }

  get isSuspended() {
    return this.text?.trim().endsWith("suspended account. {learnmore}");
  }

  async populate() {
    if (!this.populated) {
      if (this.favorite.fullText) {
        const odata = await getOembedData(this.favorite.tweetId);
        if (!odata.error) {
          this.handle = odata.screen_name;
          this.displayName = odata.name;
          this.tweetDate = odata.date;
          this.deleted = odata.deleted;
          this.expanded = this.favorite.fullText;
        }

        const urls = /http[s]?:\/\/[0-9a-zA-Z\.-_]+\/[0-9a-zA-Z]+/.exec(this.favorite.fullText);
        if (urls) {
          const mapping: Record<string, string> = {};
          for (const match of urls) {
            const full = await unwrapUrl(match);
            mapping[match] = full.final;
          }

          for (const [short, long] of Object.entries(mapping)) {
            this.expanded = this.expanded?.replaceAll(short, long);
          }
        }
      }
      this.populated = true;
    }
  
    return Promise.resolve(this);
  }
}
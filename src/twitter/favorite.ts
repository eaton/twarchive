import { PartialFavorite } from "twitter-archive-reader";
import { getOembedData } from "./util.js";
import { unwrapUrl } from "../shared/unwrap-url.js";

export class Favorite {
  populated = false;
  id?: string;
  tweetDate?: string;
  favDate?: string;
  handle?: string;
  displayName?: string;
  url?: string;
  text?: string;
  raw?: string;
  deleted = false;

  static fromPartial(favorite: PartialFavorite) {
    const fav = new Favorite();
    fav.id == favorite.tweetId;
    fav.raw = favorite.fullText;
    fav.favDate = favorite.date?.toISOString();
    fav.url = favorite.expandedUrl ?? undefined;
    return fav;
  }

  static fromJSON(favorite: Record<string, unknown>) {
    const fav = new Favorite();

    fav.populated = !!favorite.populated;
    fav.id = favorite.id as string ?? undefined;
    fav.tweetDate = favorite.tweetDate as string ?? undefined;
    fav.favDate = favorite.favDate as string ?? undefined;
    fav.handle = favorite.handle as string ?? undefined;
    fav.displayName = favorite.displayName as string ?? undefined;
    fav.url = favorite.url as string ?? undefined;
    fav.text = favorite.text as string ?? undefined;
    fav.raw = favorite.raw as string ?? undefined;
    fav.deleted = !!favorite.deleted;

    return fav;
  }

  get canonical() {
    return this.url ?? `https://twitter.com/${this.handle ?? 'twitter'}/status/${this.id}`;
  }

  get isRestricted() {
    return this.text?.trim().endsWith("limits who can view their Tweets. {learnmore}");
  }

  get isSuspended() {
    return this.text?.trim().endsWith("suspended account. {learnmore}");
  }

  async populate() {
    if (!this.populated) {
      if (this.raw && this.id) {
        const odata = await getOembedData(this.id);
        if (!odata.error) {
          this.handle = odata.screen_name;
          this.displayName = odata.name;
          this.tweetDate = odata.date.toISOString();
          this.deleted = odata.deleted;
        }

        const urls = /http[s]?:\/\/[0-9a-zA-Z\.-_]+\/[0-9a-zA-Z]+/.exec(this.raw ?? '');
        if (urls) {
          const mapping: Record<string, string> = {};
          for (const match of urls) {
            const full = await unwrapUrl(match);
            mapping[match] = full.final;
          }

          for (const [short, long] of Object.entries(mapping)) {
            this.text = this.text?.replaceAll(short, long);
          }
        }
      }
      this.populated = true;
    }
  
    return Promise.resolve(this);
  }

  toJSON() {
    return {
      id: this.id,
      tweetDate: this.tweetDate,
      favDate: this.favDate,
      handle: this.handle,
      displayName: this.displayName,
      url: this.url,
      raw: this.raw,
      text: this.text,
      deleted: this.deleted,
      populated: this.populated
    }
  }
}
import { loadTwitterArchive } from './twitter/util.js';
import { Favorite } from './twitter/favorite.js';

import * as fse from 'fs-extra';
const { readJSON, writeJSON, ensureDir, statSync } = fse;

await processFavs();

export async function processFavs() {
  await ensureDir(`output/twitter`);

  await getFavsData();

  return Promise.resolve();
}

export async function getFavsData() {
  await ensureDir(`output/twitter`);
  let favs: Favorite[] = [];

  if (statSync('output/twitter/favorites.json')) {
    console.log('faves exist');
    favs = (await readJSON('output/twitter/favorites.json') as Record<string, unknown>[]).map(f => Favorite.fromJSON(f))
  } else {
    console.log('no favs');
    const archive = await loadTwitterArchive();
    for (const f of archive.favorites) {
      favs.push(Favorite.fromPartial(f));
    }
    await writeJSON('output/twitter/favorites.json', favs);
  }

  if (Array.isArray(favs)) return favs;
  return [];
}
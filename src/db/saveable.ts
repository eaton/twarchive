export interface SerializableEntity<T = unknown> {
  toJSON(): unknown;
  fromJSON(input: string): T;
  _key: string;
  _id: string;
}
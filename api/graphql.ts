import { yoga } from '../src/server/yoga.js';

export default async function handler(req: any, res: any) {
  return yoga(req, res);
}

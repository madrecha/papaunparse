import { readFile } from 'fs/promises';

import { unparse } from "../index.js";

const sample01 = await readFile(
  new URL('./sample01.json', import.meta.url),
  { encoding: 'utf8' } // Specifying encoding, other wise "readFile" will return a buffer
)



console.log(unparse(sample01));
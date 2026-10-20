import { readFileSync, writeFileSync } from 'node:fs';

const bodyPath = '/tmp/ch16-body.md';
const target = 'scheme-books/book-of-one-shot/ch16-the-grand-one-shot.book.slatl';

const body = readFileSync(bodyPath, 'utf8');
const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const size = Buffer.byteLength(body, 'utf8');

const header = `;; ch16-the-grand-one-shot.slat
;; Book of One-Shot — Chapter 16: The Grand One-Shot

(chapter
  :audience             programmer-learning-motoi
  :dialect              motoi
  :voice                motoi-copilot
  :training-eligible    #t
  :confidentiality      public
  :book             "Book of One-Shot"
  :chapter-number   null
  :title            "Chapter 16: The Grand One-Shot"
  :source-path      "/Users/alfred/code/curator/BOOK/A-branch-scheme-books/one-shot/ch16-the-grand-one-shot.md"
  :size             ${size}
  :sha256           null
  :prose
"${escaped}")
`;

writeFileSync(target, header, 'utf8');
console.log(`wrote ${target}: body ${size} bytes, escaped ${escaped.length} chars`);

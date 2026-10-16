import fs from 'node:fs';
import zlib from 'node:zlib';

function createPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth: 8
  ihdr.writeUInt8(2, 9); // color type: 2 (truecolor RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC
    let c = 0xffffffff;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let curr = n;
      for (let k = 0; k < 8; k++) {
        curr = (curr & 1) ? (0xedb88320 ^ (curr >>> 1)) : (curr >>> 1);
      }
      crcTable[n] = curr;
    }
    for (let i = 4; i < 8 + len; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    buf.writeInt32BE(~c, 8 + len);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with scanline filters (filter byte 0 per row)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      // Draw dark slate background with a blue/indigo center box
      const isCenter = (x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75);
      if (isCenter) {
        rawData[pxOffset] = 59;     // #3b82f6 Blue
        rawData[pxOffset + 1] = 130;
        rawData[pxOffset + 2] = 246;
      } else {
        rawData[pxOffset] = r;      // #0f172a Dark slate
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const dir = './public';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(`${dir}/pwa-192x192.png`, createPng(192, 192, 15, 23, 42));
fs.writeFileSync(`${dir}/pwa-512x512.png`, createPng(512, 512, 15, 23, 42));
fs.writeFileSync(`${dir}/pwa-maskable-512x512.png`, createPng(512, 512, 15, 23, 42));
fs.writeFileSync(`${dir}/apple-touch-icon.png`, createPng(180, 180, 15, 23, 42));
fs.writeFileSync(`${dir}/favicon.ico`, createPng(32, 32, 15, 23, 42));
console.log('Icons generated successfully.');

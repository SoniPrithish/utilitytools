const fs = require('fs');
const path = require('path');

// Create a simple valid BMP image (24-bit, 100x100 pixels, gradient)
function createBMP() {
  const width = 100;
  const height = 100;
  const rowSize = Math.ceil((width * 3) / 4) * 4; // Row size must be multiple of 4
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize; // 54 bytes header + pixel data

  const buffer = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buffer.write('BM', 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(54, 10); // Pixel data offset

  // DIB Header (40 bytes)
  buffer.writeUInt32LE(40, 14); // DIB header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height
  buffer.writeUInt16LE(1, 26); // Color planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // Compression (none)
  buffer.writeUInt32LE(pixelDataSize, 34); // Image size
  buffer.writeInt32LE(2835, 38); // Horizontal resolution
  buffer.writeInt32LE(2835, 42); // Vertical resolution
  buffer.writeUInt32LE(0, 46); // Colors in palette
  buffer.writeUInt32LE(0, 50); // Important colors

  // Pixel data (bottom-up, BGR format)
  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create a gradient pattern
      const r = Math.floor((x / width) * 255);
      const g = Math.floor((y / height) * 255);
      const b = Math.floor(((x + y) / (width + height)) * 255);
      
      buffer.writeUInt8(b, offset++); // Blue
      buffer.writeUInt8(g, offset++); // Green
      buffer.writeUInt8(r, offset++); // Red
    }
    // Padding to make row size multiple of 4
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      buffer.writeUInt8(0, offset++);
    }
  }

  return buffer;
}

// Create test image
const testDir = path.join(__dirname, 'public', 'test-files');
const bmpBuffer = createBMP();
fs.writeFileSync(path.join(testDir, 'test-image.bmp'), bmpBuffer);
console.log('Created test-image.bmp (100x100 gradient)');

// Also create a second test image with different colors
function createBMP2() {
  const width = 150;
  const height = 100;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);

  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create a different gradient pattern (purple/blue)
      const r = Math.floor(Math.sin(x / 10) * 127 + 128);
      const g = Math.floor(Math.cos(y / 10) * 127 + 128);
      const b = 200;
      
      buffer.writeUInt8(b, offset++);
      buffer.writeUInt8(g, offset++);
      buffer.writeUInt8(r, offset++);
    }
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      buffer.writeUInt8(0, offset++);
    }
  }

  return buffer;
}

const bmpBuffer2 = createBMP2();
fs.writeFileSync(path.join(testDir, 'test-image-2.bmp'), bmpBuffer2);
console.log('Created test-image-2.bmp (150x100 wave pattern)');

console.log('Test images created in public/test-files/');


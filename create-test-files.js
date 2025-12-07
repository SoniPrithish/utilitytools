const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

async function createTestFiles() {
  const testDir = path.join(__dirname, 'public', 'test-files');
  
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a simple PNG image using raw bytes (1x1 red pixel)
  // This is a minimal valid PNG
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x64, // width: 100
    0x00, 0x00, 0x00, 0x64, // height: 100
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x9D, 0xBC, 0xAB, 0x86, // CRC
  ]);
  
  // Create a simple test PDF
  const pdfDoc = await PDFDocument.create();
  
  // Add 3 pages
  for (let i = 1; i <= 3; i++) {
    const page = pdfDoc.addPage([612, 792]);
    page.drawText(`Test PDF - Page ${i}`, {
      x: 50,
      y: 700,
      size: 30,
      color: rgb(0, 0, 0),
    });
    page.drawText(`This is a test page for the UtilityTools app.`, {
      x: 50,
      y: 650,
      size: 14,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(testDir, 'test-document.pdf'), pdfBytes);
  console.log('Created test-document.pdf');

  // Create second PDF
  const pdfDoc2 = await PDFDocument.create();
  const page2 = pdfDoc2.addPage([612, 792]);
  page2.drawText('Second Test PDF', {
    x: 50,
    y: 700,
    size: 30,
    color: rgb(0, 0, 0),
  });
  const pdfBytes2 = await pdfDoc2.save();
  fs.writeFileSync(path.join(testDir, 'test-document-2.pdf'), pdfBytes2);
  console.log('Created test-document-2.pdf');

  console.log('Test files created in public/test-files/');
}

createTestFiles().catch(console.error);


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../src/assets');

async function compressPngs() {
  console.log(`Scanning assets directory: ${assetsDir}`);
  if (!fs.existsSync(assetsDir)) {
    console.error(`Assets directory does not exist: ${assetsDir}`);
    return;
  }
  
  const files = fs.readdirSync(assetsDir);
  const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
  console.log(`Found ${pngFiles.length} PNG files to compress.`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of pngFiles) {
    const inputPath = path.join(assetsDir, file);
    const outputName = file.substring(0, file.lastIndexOf('.')) + '.webp';
    const outputPath = path.join(assetsDir, outputName);

    console.log(`Compressing ${file} -> ${outputName}...`);
    try {
      const statsBefore = fs.statSync(inputPath);
      totalBefore += statsBefore.size;
      
      // Perform lossy but visually pristine WebP conversion with highest compression efforts
      await sharp(inputPath)
        .webp({ quality: 85, effort: 6 })
        .toFile(outputPath);
        
      const statsAfter = fs.statSync(outputPath);
      totalAfter += statsAfter.size;
      const savings = ((statsBefore.size - statsAfter.size) / statsBefore.size * 100).toFixed(2);
      console.log(`[OK] ${(statsBefore.size / 1024).toFixed(1)} KB -> ${(statsAfter.size / 1024).toFixed(1)} KB (Saved ${savings}%)`);
    } catch (err) {
      console.error(`[ERROR] Failed to compress ${file}:`, err);
    }
  }

  if (pngFiles.length > 0) {
    const totalSavings = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);
    console.log(`\n=============================================`);
    console.log(`Image Compression Summary:`);
    console.log(`Total Original Size: ${(totalBefore / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Total Optimized Size: ${(totalAfter / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Total Space Saved: ${((totalBefore - totalAfter) / (1024 * 1024)).toFixed(2)} MB (${totalSavings}%)`);
    console.log(`=============================================`);
  }
}

compressPngs();

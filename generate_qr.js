import QRCode from 'qrcode';
import fs from 'fs';

const url = 'http://192.168.10.105:5173/';

// 1. Generate ASCII QR Code for terminal display
QRCode.toString(url, { type: 'terminal', small: true }, (err, qrcodeStr) => {
  if (err) console.error(err);
  console.log('\n================ SCAN WITH YOUR IPHONE 13 CAMERA ================');
  console.log(qrcodeStr);
  console.log('=================================================================\n');
});

// 2. Save PNG QR Code to public/qr_code.png
QRCode.toDataURL(url, { width: 400, margin: 2 }, (err, dataUrl) => {
  if (err) return;
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('public/qr_code.png', base64Data, 'base64');
  console.log('Saved QR code image to public/qr_code.png');
});

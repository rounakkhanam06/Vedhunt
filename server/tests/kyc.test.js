const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../services/kycValidators');
const kyc = require('../services/kyc');
const { encrypt } = require('../utils/encryption');

const VEDHUNT_GSTIN = '27AALCV0172E1ZD'; // Vedhunt's own registered GSTIN (server/config/company.js)
const aadhaar = (base11) => base11 + v.verhoeffCheckDigit(base11);

describe('GSTIN', () => {
  test('a real GSTIN passes, including when typed in lower case with spaces', () => {
    assert.equal(v.validateGstin(VEDHUNT_GSTIN).ok, true);
    assert.equal(v.validateGstin(' 27aalcv0172e1zd ').value, VEDHUNT_GSTIN);
  });
  test('a wrong check digit is caught', () => {
    const r = v.validateGstin('27AALCV0172E1ZE');
    assert.equal(r.ok, false);
    assert.match(r.error, /check digit/);
  });
  test('wrong shape, length or state code is refused', () => {
    assert.equal(v.validateGstin('27AALCV0172E1Z').ok, false);
    assert.equal(v.validateGstin('ABAALCV0172E1ZD').ok, false);
    assert.equal(v.validateGstin('99AALCV0172E1ZD').ok, false); // 99 is valid shape-wise but its check digit differs
    assert.match(v.validateGstin('00AALCV0172E1ZD').error, /state code/);
    assert.equal(v.validateGstin('').ok, false);
  });
});

describe('PAN', () => {
  test('valid PANs pass and report the holder type', () => {
    assert.deepEqual([v.validatePan('AALCV0172E').ok, v.validatePan('AALCV0172E').holderType], [true, 'Company']);
    assert.equal(v.validatePan('abcpe1234f').holderType, 'Individual');
  });
  test('bad structure or holder type is refused', () => {
    for (const bad of ['AALCV0172', 'AALCV01721', '12345ABCDE', 'ABCZE1234F', 'ABCDE12345']) assert.equal(v.validatePan(bad).ok, false, bad);
  });
  test('the PAN inside a GSTIN is compared with the submitted PAN', () => {
    assert.equal(v.panMatchesGstin('AALCV0172E', VEDHUNT_GSTIN), true);
    assert.equal(v.panMatchesGstin('ABCDE1234F', VEDHUNT_GSTIN), false);
    assert.equal(v.panMatchesGstin('', VEDHUNT_GSTIN), false);
  });
});

describe('Aadhaar', () => {
  test('a number with a correct Verhoeff check digit passes', () => {
    assert.equal(v.validateAadhaar(aadhaar('23456789012')).ok, true);
    assert.equal(v.validateAadhaar('2345 6789 0124').ok, true, 'spaces are fine');
  });
  test('any single changed digit fails the check', () => {
    const good = aadhaar('23456789012');
    for (let i = 0; i < 12; i += 1) {
      const changed = good.slice(0, i) + ((Number(good[i]) + 1) % 10) + good.slice(i + 1);
      if (i === 0 && /^[01]/.test(changed)) continue;
      assert.equal(v.validateAadhaar(changed).ok, false, `position ${i}`);
    }
  });
  test('wrong length or a leading 0/1 is refused', () => {
    assert.equal(v.validateAadhaar('12345').ok, false);
    assert.match(v.validateAadhaar(aadhaar('12345678901')).error, /cannot start/);
    assert.equal(v.validateAadhaar(aadhaar('02345678901')).ok, false);
  });
});

describe('masking', () => {
  test('PAN and Aadhaar are masked to what is safe to show', () => {
    assert.equal(v.maskPan('ABCDE1234F'), 'XXXXX1234F');
    assert.equal(v.maskAadhaarLast4('0124'), 'XXXX XXXX 0124');
    assert.equal(v.maskPan(''), '');
  });
});

describe('uploaded files are identified by their bytes, not their name', () => {
  const pad = Buffer.alloc(64, 1);
  test('JPEG, PNG, WEBP and PDF are recognised', () => {
    assert.equal(v.detectFileType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), 'image/jpeg');
    assert.equal(v.detectFileType(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), 'image/png');
    assert.equal(v.detectFileType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), pad])), 'image/webp');
    assert.equal(v.detectFileType(Buffer.concat([Buffer.from('%PDF-1.7\n'), pad])), 'application/pdf');
  });
  test('executables, scripts, SVG and tiny files are rejected', () => {
    assert.equal(v.detectFileType(Buffer.concat([Buffer.from('MZ'), pad])), null);
    assert.equal(v.detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
    assert.equal(v.detectFileType(Buffer.from('<html><script>alert(1)</script></html>')), null);
    assert.equal(v.detectFileType(Buffer.from([0xff, 0xd8])), null);
  });
});

// A plain object shaped like the saved record
const doc = (items = {}) => ({ client_ref: 'c1', items: { gst: {}, pan: {}, aadhaar: {}, photo: {}, brand_authorisation: {}, ...items } });
const st = (status) => ({ status });

describe('overall KYC status', () => {
  test('nothing submitted is "not started"', () => assert.equal(kyc.overall(doc()).status, 'not_started'));
  test('some submitted, some missing is "in review" while anything waits for staff', () => {
    assert.equal(kyc.overall(doc({ gst: st('Submitted') })).status, 'in_review');
  });
  test('verified items with nothing pending but some missing is "incomplete"', () => {
    const o = kyc.overall(doc({ gst: st('Verified'), pan: st('Verified') }));
    assert.equal(o.status, 'incomplete');
    assert.deepEqual(o.missing, ['aadhaar', 'photo']);
  });
  test('a rejected item means "action needed", whatever else is going on', () => {
    const o = kyc.overall(doc({ gst: st('Verified'), pan: st('Rejected'), aadhaar: st('Submitted') }));
    assert.equal(o.status, 'action_needed');
    assert.deepEqual(o.rejected, ['pan']);
  });
  test('verified needs all four required items; brand authorisation is optional', () => {
    const four = { gst: st('Verified'), pan: st('Verified'), aadhaar: st('Verified'), photo: st('Verified') };
    assert.equal(kyc.overall(doc(four)).status, 'verified');
    assert.equal(kyc.overall(doc({ ...four, photo: st('Submitted') })).status, 'in_review');
    assert.equal(kyc.overall(doc({ ...four, brand_authorisation: st('Submitted') })).status, 'verified');
    assert.equal(kyc.overall(doc({ ...four, brand_authorisation: st('Rejected') })).status, 'action_needed');
  });
});

describe('what the client is shown', () => {
  const stored = doc({
    gst: { status: 'Submitted', value: VEDHUNT_GSTIN, file: { fileId: 'f1', originalName: 'gst.pdf' } },
    pan: { status: 'Submitted', valueEnc: encrypt('BQRPK9087L'), file: { fileId: 'f2', originalName: 'pan.jpg' } },
    aadhaar: { status: 'Rejected', last4: '0124', rejectionReason: 'Photo is blurred', file: { fileId: 'f3' } },
  });
  const view = kyc.clientView(stored);
  const byKey = (k) => view.items.find((i) => i.key === k);

  test('numbers are masked and a rejection reason is shown', () => {
    assert.equal(byKey('pan').displayValue, 'XXXXX9087L');
    assert.equal(byKey('aadhaar').displayValue, 'XXXX XXXX 0124');
    assert.equal(byKey('aadhaar').rejectionReason, 'Photo is blurred');
    assert.equal(byKey('gst').displayValue, VEDHUNT_GSTIN);
  });
  test('no raw PAN, encrypted value or file id ever reaches the client', () => {
    const raw = JSON.stringify(view);
    for (const secret of ['BQRPK9087L', 'valueEnc', 'fileId', 'f1', 'f2', 'f3']) assert.equal(raw.includes(secret), false, secret);
  });
  test('only a verified item is locked against changes', () => {
    assert.equal(byKey('gst').canSubmit, true);
    assert.equal(kyc.clientView(doc({ gst: st('Verified') })).items[0].canSubmit, false);
  });
  test('the five items are described with their numbers and file rules', () => {
    assert.deepEqual(view.items.map((i) => i.key), ['gst', 'pan', 'aadhaar', 'photo', 'brand_authorisation']);
    assert.equal(byKey('photo').number, null);
    assert.equal(byKey('photo').accept, 'image');
    assert.equal(byKey('brand_authorisation').required, false);
  });
});

/* Koinly Tools · Copyright (C) 2026 Massimo Esposito · licenza GNU AGPL-3.0 (file LICENSE) */
/* Koinly Tools · lettura dalla blockchain dei wallet Bitcoin del cliente (senza Koinly).
   - Dalle chiavi pubbliche estese (xpub, ypub, zpub; Taproot con xpub BIP86) si ricavano gli indirizzi nel browser:
     la chiave non lascia mai il computer; al servizio esterno arrivano solo i singoli indirizzi.
   - Ogni indirizzo si interroga su mempool.space (gratuito, senza chiave): ricezione (catena 0) e resto (catena 1),
     fino a 20 indirizzi consecutivi mai usati (gap limit standard).
   - Le transazioni diventano movimenti nello stesso formato degli altri lettori: entrate, uscite con commissione di rete,
     invii a sé stessi (solo commissione). Gli indirizzi di origine e destinazione e l'hash restano sul movimento,
     così un prelievo da un exchange con lo stesso hash si riconosce come trasferimento tra wallet del cliente.
   Crittografia (SHA-256, SHA-512, HMAC, RIPEMD-160, secp256k1, Base58, Bech32/Bech32m) scritta qui, senza librerie. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./detenzione.js"));
  else root.KoinlyOnchain = factory(root.KoinlyDetenzione);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";

  /* ---------- byte ---------- */
  function concat() { var n = 0, i; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var o = new Uint8Array(n), k = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], k); k += arguments[i].length; } return o; }
  function utf8(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i) & 0xff); return new Uint8Array(o); }
  function bytesToBig(b) { var h = ""; for (var i = 0; i < b.length; i++) h += ("0" + b[i].toString(16)).slice(-2); return h ? BigInt("0x" + h) : 0n; }
  function bigToBytes(v, len) { var h = v.toString(16); while (h.length < len * 2) h = "0" + h; var o = new Uint8Array(len); for (var i = 0; i < len; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; }
  function hex(b) { var h = ""; for (var i = 0; i < b.length; i++) h += ("0" + b[i].toString(16)).slice(-2); return h; }

  /* ---------- SHA-256 ---------- */
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(m) {
    var l = m.length, nb = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(nb); p.set(m); p[l] = 0x80;
    var bits = l * 8; for (var i = 0; i < 8; i++) p[nb - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
    var r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var o = 0; o < nb; o += 64) {
      for (var t = 0; t < 16; t++) W[t] = (p[o + 4 * t] << 24) | (p[o + 4 * t + 1] << 16) | (p[o + 4 * t + 2] << 8) | p[o + 4 * t + 3];
      for (t = 16; t < 64; t++) { var s0 = r(W[t - 15], 7) ^ r(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = r(W[t - 2], 17) ^ r(W[t - 2], 19) ^ (W[t - 2] >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0; }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K256[t] + W[t]) | 0;
        var S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = new Uint8Array(32); for (i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 0xff; out[4 * i + 2] = (H[i] >>> 8) & 0xff; out[4 * i + 3] = H[i] & 0xff; }
    return out;
  }

  /* ---------- SHA-512 (BigInt: si usa solo per le derivazioni, poche per indirizzo) ---------- */
  var M64 = (1n << 64n) - 1n;
  var K512 = ["428a2f98d728ae22", "7137449123ef65cd", "b5c0fbcfec4d3b2f", "e9b5dba58189dbbc", "3956c25bf348b538", "59f111f1b605d019", "923f82a4af194f9b", "ab1c5ed5da6d8118", "d807aa98a3030242", "12835b0145706fbe",
    "243185be4ee4b28c", "550c7dc3d5ffb4e2", "72be5d74f27b896f", "80deb1fe3b1696b1", "9bdc06a725c71235", "c19bf174cf692694", "e49b69c19ef14ad2", "efbe4786384f25e3", "0fc19dc68b8cd5b5", "240ca1cc77ac9c65",
    "2de92c6f592b0275", "4a7484aa6ea6e483", "5cb0a9dcbd41fbd4", "76f988da831153b5", "983e5152ee66dfab", "a831c66d2db43210", "b00327c898fb213f", "bf597fc7beef0ee4", "c6e00bf33da88fc2", "d5a79147930aa725",
    "06ca6351e003826f", "142929670a0e6e70", "27b70a8546d22ffc", "2e1b21385c26c926", "4d2c6dfc5ac42aed", "53380d139d95b3df", "650a73548baf63de", "766a0abb3c77b2a8", "81c2c92e47edaee6", "92722c851482353b",
    "a2bfe8a14cf10364", "a81a664bbc423001", "c24b8b70d0f89791", "c76c51a30654be30", "d192e819d6ef5218", "d69906245565a910", "f40e35855771202a", "106aa07032bbd1b8", "19a4c116b8d2d0c8", "1e376c085141ab53",
    "2748774cdf8eeb99", "34b0bcb5e19b48a8", "391c0cb3c5c95a63", "4ed8aa4ae3418acb", "5b9cca4f7763e373", "682e6ff3d6b2b8a3", "748f82ee5defb2fc", "78a5636f43172f60", "84c87814a1f0ab72", "8cc702081a6439ec",
    "90befffa23631e28", "a4506cebde82bde9", "bef9a3f7b2c67915", "c67178f2e372532b", "ca273eceea26619c", "d186b8c721c0c207", "eada7dd6cde0eb1e", "f57d4f7fee6ed178", "06f067aa72176fba", "0a637dc5a2c898a6",
    "113f9804bef90dae", "1b710b35131c471b", "28db77f523047d84", "32caab7b40c72493", "3c9ebe0a15c9bebc", "431d67c49c100d4c", "4cc5d4becb3e42b6", "597f299cfc657e2a", "5fcb6fab3ad6faec", "6c44198c4a475817"].map(function (h) { return BigInt("0x" + h); });
  function sha512(m) {
    var l = m.length, nb = ((l + 17 + 127) >> 7) << 7, p = new Uint8Array(nb); p.set(m); p[l] = 0x80;
    var bits = BigInt(l) * 8n; for (var i = 0; i < 16; i++) p[nb - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
    var H = ["6a09e667f3bcc908", "bb67ae8584caa73b", "3c6ef372fe94f82b", "a54ff53a5f1d36f1", "510e527fade682d1", "9b05688c2b3e6c1f", "1f83d9abfb41bd6b", "5be0cd19137e2179"].map(function (h) { return BigInt("0x" + h); });
    var r = function (x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M64; }, W = new Array(80);
    for (var o = 0; o < nb; o += 128) {
      for (var t = 0; t < 16; t++) W[t] = bytesToBig(p.subarray(o + 8 * t, o + 8 * t + 8));
      for (t = 16; t < 80; t++) { var s0 = r(W[t - 15], 1) ^ r(W[t - 15], 8) ^ (W[t - 15] >> 7n), s1 = r(W[t - 2], 19) ^ r(W[t - 2], 61) ^ (W[t - 2] >> 6n); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) & M64; }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 80; t++) {
        var S1 = r(e, 14) ^ r(e, 18) ^ r(e, 41), ch = (e & f) ^ (~e & M64 & g), t1 = (h + S1 + ch + K512[t] + W[t]) & M64;
        var S0 = r(a, 28) ^ r(a, 34) ^ r(a, 39), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) & M64;
        h = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
      }
      H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(function (x) { return x & M64; });
    }
    return concat.apply(null, H.map(function (x) { return bigToBytes(x, 8); }));
  }
  function hmacSha512(key, msg) {
    if (key.length > 128) key = sha512(key);
    var k = new Uint8Array(128); k.set(key);
    var ip = new Uint8Array(128), op = new Uint8Array(128);
    for (var i = 0; i < 128; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    return sha512(concat(op, sha512(concat(ip, msg))));
  }

  /* ---------- RIPEMD-160 ---------- */
  function ripemd160(m) {
    var l = m.length, nb = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(nb); p.set(m); p[l] = 0x80;
    var bits = l * 8; for (var i = 0; i < 8; i++) p[nb - 8 + i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
    var zl = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
    var zr = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
    var sl = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
    var sr = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];
    var hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e], hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
    var f = function (j, x, y, z) { return j < 16 ? x ^ y ^ z : j < 32 ? (x & y) | (~x & z) : j < 48 ? (x | ~y) ^ z : j < 64 ? (x & z) | (y & ~z) : x ^ (y | ~z); };
    var rol = function (x, n) { return (x << n) | (x >>> (32 - n)); };
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0, X = new Array(16);
    for (var o = 0; o < nb; o += 64) {
      for (var t = 0; t < 16; t++) X[t] = p[o + 4 * t] | (p[o + 4 * t + 1] << 8) | (p[o + 4 * t + 2] << 16) | (p[o + 4 * t + 3] << 24);
      var al = h0, bl = h1, cl = h2, dl = h3, el = h4, ar = h0, br = h1, cr = h2, dr = h3, er = h4, T;
      for (var j = 0; j < 80; j++) {
        T = (rol((al + f(j, bl, cl, dl) + X[zl[j]] + hl[j >> 4]) | 0, sl[j]) + el) | 0; al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = T;
        T = (rol((ar + f(79 - j, br, cr, dr) + X[zr[j]] + hr[j >> 4]) | 0, sr[j]) + er) | 0; ar = er; er = dr; dr = rol(cr, 10); cr = br; br = T;
      }
      T = (h1 + cl + dr) | 0; h1 = (h2 + dl + er) | 0; h2 = (h3 + el + ar) | 0; h3 = (h4 + al + br) | 0; h4 = (h0 + bl + cr) | 0; h0 = T;
    }
    var out = new Uint8Array(20);
    [h0, h1, h2, h3, h4].forEach(function (h, i) { out[4 * i] = h & 0xff; out[4 * i + 1] = (h >>> 8) & 0xff; out[4 * i + 2] = (h >>> 16) & 0xff; out[4 * i + 3] = (h >>> 24) & 0xff; });
    return out;
  }
  function hash160(b) { return ripemd160(sha256(b)); }

  /* ---------- Base58 e Bech32 ---------- */
  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function base58enc(b) {
    var v = bytesToBig(b), s = ""; while (v > 0n) { s = B58[Number(v % 58n)] + s; v /= 58n; }
    for (var i = 0; i < b.length && b[i] === 0; i++) s = "1" + s;
    return s;
  }
  function base58dec(s) {
    var v = 0n; for (var i = 0; i < s.length; i++) { var k = B58.indexOf(s[i]); if (k < 0) throw new Error("carattere non valido"); v = v * 58n + BigInt(k); }
    var h = v.toString(16); if (h.length % 2) h = "0" + h; if (v === 0n) h = "";
    var z = 0; while (z < s.length && s[z] === "1") z++;
    var o = new Uint8Array(z + h.length / 2); for (i = 0; i < h.length / 2; i++) o[z + i] = parseInt(h.substr(2 * i, 2), 16);
    return o;
  }
  function base58check(payload) { return base58enc(concat(payload, sha256(sha256(payload)).subarray(0, 4))); }
  function base58checkDec(s) {
    var b = base58dec(s), p = b.subarray(0, b.length - 4), c = sha256(sha256(p)).subarray(0, 4);
    for (var i = 0; i < 4; i++) if (c[i] !== b[b.length - 4 + i]) throw new Error("checksum errato");
    return p;
  }
  var B32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  function polymod(v) { var G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3], c = 1; v.forEach(function (x) { var b = c >> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (var i = 0; i < 5; i++) if ((b >> i) & 1) c ^= G[i]; }); return c; }
  function bech32(hrp, ver, prog) {
    var data = [ver], acc = 0, bits = 0;
    for (var i = 0; i < prog.length; i++) { acc = (acc << 8) | prog[i]; bits += 8; while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); } }
    if (bits) data.push((acc << (5 - bits)) & 31);
    var hx = []; for (i = 0; i < hrp.length; i++) hx.push(hrp.charCodeAt(i) >> 5); hx.push(0); for (i = 0; i < hrp.length; i++) hx.push(hrp.charCodeAt(i) & 31);
    var cost = ver === 0 ? 1 : 0x2bc830a3, pm = polymod(hx.concat(data, [0, 0, 0, 0, 0, 0])) ^ cost, s = hrp + "1";
    data.forEach(function (d) { s += B32[d]; });
    for (i = 0; i < 6; i++) s += B32[(pm >> (5 * (5 - i))) & 31];
    return s;
  }

  /* ---------- secp256k1 (coordinate jacobiane) ---------- */
  var P = 2n ** 256n - 2n ** 32n - 977n, N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
  var G = [BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"), BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")];
  function mod(a, m) { var r = a % (m || P); return r < 0n ? r + (m || P) : r; }
  function powm(b, e, m) { var r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
  function inv(a) { return powm(a, P - 2n, P); }
  function jDouble(p) { if (!p || p[1] === 0n) return null; var X = p[0], Y = p[1], Z = p[2]; var YY = Y * Y % P, S = 4n * X * YY % P, M = 3n * X * X % P; var X3 = mod(M * M - 2n * S), Y3 = mod(M * (S - X3) - 8n * YY * YY), Z3 = 2n * Y * Z % P; return [X3, Y3, Z3]; }
  function jAdd(p, q) {
    if (!p) return q; if (!q) return p;
    var Z1Z1 = p[2] * p[2] % P, Z2Z2 = q[2] * q[2] % P, U1 = p[0] * Z2Z2 % P, U2 = q[0] * Z1Z1 % P, S1 = p[1] * q[2] % P * Z2Z2 % P, S2 = q[1] * p[2] % P * Z1Z1 % P;
    if (U1 === U2) return S1 === S2 ? jDouble(p) : null;
    var H = mod(U2 - U1), R = mod(S2 - S1), HH = H * H % P, HHH = H * HH % P, V = U1 * HH % P;
    var X3 = mod(R * R - HHH - 2n * V), Y3 = mod(R * (V - X3) - S1 * HHH), Z3 = p[2] * q[2] % P * H % P;
    return [X3, Y3, Z3];
  }
  function affine(p) { if (!p) return null; var zi = inv(p[2]), z2 = zi * zi % P; return [p[0] * z2 % P, p[1] * z2 % P * zi % P]; }
  function mul(k, pt) { var r = null, a = [pt[0], pt[1], 1n]; while (k > 0n) { if (k & 1n) r = jAdd(r, a); a = jDouble(a); k >>= 1n; } return affine(r); }
  function addPt(a, b) { return affine(jAdd([a[0], a[1], 1n], [b[0], b[1], 1n])); }
  function decomprimi(b) { var x = bytesToBig(b.subarray(1)), y = powm(mod(x * x * x + 7n), (P + 1n) / 4n, P); if ((y & 1n) !== BigInt(b[0] & 1)) y = P - y; return [x, y]; }
  function comprimi(pt) { return concat(new Uint8Array([pt[1] & 1n ? 3 : 2]), bigToBytes(pt[0], 32)); }

  /* ---------- chiavi estese (BIP32) ---------- */
  var VERSIONI = { "0488b21e": "xpub", "049d7cb2": "ypub", "04b24746": "zpub", "0295b43f": "Ypub", "02aa7ed3": "Zpub", "043587cf": "tpub" };
  function leggiChiave(s) {
    var b = base58checkDec(String(s).trim());
    if (b.length !== 78) throw new Error("lunghezza della chiave non valida");
    var ver = hex(b.subarray(0, 4));
    return { versione: VERSIONI[ver] || ver, profondita: b[4], catena: b.subarray(13, 45), pub: b.subarray(45, 78), punto: decomprimi(b.subarray(45, 78)) };
  }
  function figlio(k, i) {
    var I = hmacSha512(k.catena, concat(k.pub, bigToBytes(BigInt(i), 4))), IL = bytesToBig(I.subarray(0, 32));
    if (IL >= N) throw new Error("indice non valido");
    var pt = addPt(mul(IL, G), k.punto);
    return { catena: I.subarray(32), pub: comprimi(pt), punto: pt };
  }
  /* tipo di indirizzo: dalla chiave (ypub → p2sh-p2wpkh, zpub → p2wpkh) o dall'indicazione del cliente per le xpub (BIP44, BIP84, BIP86) */
  function tipoIndirizzo(versione, indicazione) {
    var t = String(indicazione || "").toLowerCase();
    if (/taproot|bip ?86|p2tr/.test(t)) return "p2tr";
    if (versione === "zpub" || /native|bip ?84|p2wpkh|bech32/.test(t)) return "p2wpkh";
    if (versione === "ypub" || /segwit|bip ?49|p2sh/.test(t)) return "p2sh-p2wpkh";
    return "p2pkh";
  }
  function taggedHash(tag, m) { var th = sha256(utf8(tag)); return sha256(concat(th, th, m)); }
  function indirizzo(pubC, tipo) {
    if (tipo === "p2pkh") return base58check(concat(new Uint8Array([0]), hash160(pubC)));
    if (tipo === "p2wpkh") return bech32("bc", 0, hash160(pubC));
    if (tipo === "p2sh-p2wpkh") return base58check(concat(new Uint8Array([5]), hash160(concat(new Uint8Array([0, 20]), hash160(pubC)))));
    if (tipo === "p2tr") {
      var pt = decomprimi(pubC); if (pt[1] & 1n) pt = [pt[0], P - pt[1]];
      var xo = bigToBytes(pt[0], 32), t = bytesToBig(taggedHash("TapTweak", xo));
      return bech32("bc", 1, bigToBytes(addPt(pt, mul(t, G))[0], 32));
    }
    throw new Error("tipo di indirizzo sconosciuto");
  }
  /* indirizzo n. i della catena c (0 ricezione, 1 resto) */
  function deriva(chiave, tipo, c, i) {
    var k = typeof chiave === "string" ? leggiChiave(chiave) : chiave;
    var kc = k._figli && k._figli[c] || (k._figli = k._figli || {}, k._figli[c] = figlio(k, c));
    return indirizzo(figlio(kc, i).pub, tipo);
  }

  /* ---------- lettura da mempool.space ---------- */
  var API = "https://mempool.space/api";
  /* opz.json(url) → Promise del JSON (iniettabile per le prove); opz.gap (20); opz.avanzamento(testo); opz.cache (oggetto) */
  async function leggiWallet(chiave, indicazione, opz) {
    opz = opz || {};
    var k = leggiChiave(chiave), tipo = tipoIndirizzo(k.versione, indicazione), gap = opz.gap || 20, json = opz.json, cache = opz.cache || {};
    var get = async function (url) { if (cache[url]) return cache[url]; var v = await json(url); cache[url] = v; return v; };
    var miei = {}, usati = [], txs = {}, interrogati = 0;
    for (var c = 0; c <= 1; c++) {
      var vuoti = 0;
      for (var i = 0; vuoti < gap; i++) {
        var a = deriva(k, tipo, c, i); miei[a] = c + "/" + i; interrogati++;
        var info = await get(API + "/address/" + a);
        var n = (info.chain_stats ? info.chain_stats.tx_count : 0) + (info.mempool_stats ? info.mempool_stats.tx_count : 0);
        if (opz.avanzamento) opz.avanzamento(a, c, i, n);
        if (!n) { vuoti++; continue; }
        vuoti = 0; usati.push(a);
        var ultimo = null, pagina;
        do {
          pagina = await get(API + "/address/" + a + "/txs" + (ultimo ? "/chain/" + ultimo : ""));
          var conf = pagina.filter(function (t) { return t.status && t.status.confirmed; });
          pagina.forEach(function (t) { txs[t.txid] = t; });
          ultimo = conf.length ? conf[conf.length - 1].txid : null;
        } while (ultimo && pagina.filter(function (t) { return t.status && t.status.confirmed; }).length >= 25);
      }
    }
    return { tipo: tipo, versione: k.versione, indirizzi: miei, usati: usati, interrogati: interrogati, transazioni: Object.keys(txs).map(function (id) { return txs[id]; }) };
  }

  /* indirizzi singoli (senza chiave estesa: es. l'indirizzo di ricezione Relai o un elenco di indirizzi di un'app) */
  async function leggiIndirizzi(indirizzi, opz) {
    opz = opz || {};
    var json = opz.json, cache = opz.cache || {}, miei = {}, usati = [], txs = {};
    var get = async function (url) { if (cache[url]) return cache[url]; var v = await json(url); cache[url] = v; return v; };
    for (var i = 0; i < indirizzi.length; i++) {
      var a = String(indirizzi[i]).trim(); if (!a) continue; miei[a] = "elenco/" + i;
      var info = await get(API + "/address/" + a);
      var n = (info.chain_stats ? info.chain_stats.tx_count : 0) + (info.mempool_stats ? info.mempool_stats.tx_count : 0);
      if (opz.avanzamento) opz.avanzamento(a, 0, i, n);
      if (!n) continue;
      usati.push(a);
      var ultimo = null, pagina;
      do {
        pagina = await get(API + "/address/" + a + "/txs" + (ultimo ? "/chain/" + ultimo : ""));
        pagina.forEach(function (t) { txs[t.txid] = t; });
        var conf = pagina.filter(function (t) { return t.status && t.status.confirmed; });
        ultimo = conf.length >= 25 ? conf[conf.length - 1].txid : null;
      } while (ultimo);
    }
    return { tipo: "indirizzi", indirizzi: miei, usati: usati, interrogati: indirizzi.length, transazioni: Object.keys(txs).map(function (id) { return txs[id]; }) };
  }

  /* ---------- reti compatibili con Ethereum (Blockscout, API in formato Etherscan) ---------- */
  var RETI = {
    ethereum: { nome: "Ethereum", api: "https://eth.blockscout.com/api", nativa: "ETH" },
    base: { nome: "Base", api: "https://base.blockscout.com/api", nativa: "ETH" },
    polygon: { nome: "Polygon", api: "https://polygon.blockscout.com/api", nativa: "POL" },
    arbitrum: { nome: "Arbitrum", api: "https://arbitrum.blockscout.com/api", nativa: "ETH" },
    optimism: { nome: "Optimism", api: "https://optimism.blockscout.com/api", nativa: "ETH" },
    gnosis: { nome: "Gnosis", api: "https://gnosis.blockscout.com/api", nativa: "XDAI" }
  };
  /* token spam: simboli con indirizzi web, inviti a «riscattare», caratteri che imitano token noti */
  function tokenSpam(sim, nome) {
    var s = String(sim || "") + " " + String(nome || "");
    if (/[^\x20-\x7E]/.test(String(sim || ""))) return "simbolo con caratteri che imitano un token noto";
    if (/https?:|www\.|\.(xyz|site|com|io|net|org|link|app|me|top|pro|vip|cc|gift)\b|t\.me\/|\bclaim\b|\bvisit\b|\bvoucher\b|\breward/i.test(s) || /\s/.test(String(sim || "").trim())) return "nome con indirizzo web o invito a «riscattare»";
    return "";
  }
  async function leggiEvm(indirizzo, rete, opz) {
    opz = opz || {};
    var R = typeof rete === "string" ? RETI[rete] : rete, json = opz.json, cache = opz.cache || {}, mio = String(indirizzo).toLowerCase();
    var get = async function (url) { if (cache[url]) return cache[url]; var v = await json(url); cache[url] = v; return v; };
    var tutte = async function (azione) {
      var out = [], pag = 1, dim = 1000;
      while (true) {
        var r = await get(R.api + "?module=account&action=" + azione + "&address=" + mio + "&page=" + pag + "&offset=" + dim + "&sort=asc");
        var l = Array.isArray(r.result) ? r.result : [];
        l.forEach(function (x) { out.push(x); });
        if (opz.avanzamento) opz.avanzamento(azione, pag, out.length);
        if (l.length < dim) break;
        pag++;
      }
      return out;
    };
    return { rete: R, indirizzo: mio, normali: await tutte("txlist"), token: await tutte("tokentx"), interne: await tutte("txlistinternal") };
  }
  /* transazioni EVM → movimenti: per ogni hash si sommano le variazioni per cripto (valuta nativa, transazioni interne, token) */
  function movimentiEvm(dati, nomeWallet) {
    var mio = dati.indirizzo, nat = dati.rete.nativa, per = {}, spam = {}, D18 = function (v, dec) { var s = String(v || "0"); dec = +dec || 0; if (!dec) return D.dec(s); while (s.length <= dec) s = "0" + s; return D.dec(s.slice(0, s.length - dec) + "." + s.slice(s.length - dec)); };
    var h = function (hash, ts) { return per[hash] || (per[hash] = { hash: hash, ts: ts, var: {}, fee: 0n, da: "", a: "", metodo: "", errore: false }); };
    var add = function (x, sim, q) { x.var[sim] = (x.var[sim] || 0n) + q; };
    dati.normali.forEach(function (t) {
      var x = h(t.hash, +t.timeStamp * 1000), err = t.isError === "1" || t.txreceipt_status === "0";
      if (err) x.errore = true;
      x.metodo = x.metodo || t.functionName || t.methodId || "";
      var v = D18(t.value, 18);
      if (!err && v) { if (t.to && t.to.toLowerCase() === mio) { add(x, nat, v); x.da = x.da || t.from; } if (t.from.toLowerCase() === mio) { add(x, nat, -v); x.a = x.a || t.to; } }
      if (t.from.toLowerCase() === mio) x.fee += D18(String(BigInt(t.gasUsed || "0") * BigInt(t.gasPrice || "0")), 18);
    });
    dati.interne.forEach(function (t) {
      if (t.isError === "1") return;
      var x = h(t.transactionHash || t.hash, +t.timeStamp * 1000), v = D18(t.value, 18); if (!v) return;
      if (t.to && t.to.toLowerCase() === mio) { add(x, nat, v); x.da = x.da || t.from; }
      if (t.from && t.from.toLowerCase() === mio) { add(x, nat, -v); x.a = x.a || t.to; }
    });
    dati.token.forEach(function (t) {
      var sim = String(t.tokenSymbol || "").trim().toUpperCase(), m = tokenSpam(t.tokenSymbol, t.tokenName);
      var v = D18(t.value, t.tokenDecimal);
      if (m || !v || !sim) { if (m) spam[sim] = m; return; }
      var x = h(t.hash, +t.timeStamp * 1000), da = t.from.toLowerCase(), a = (t.to || "").toLowerCase();
      if (a === mio && da !== mio) { add(x, sim, v); x.da = x.da || t.from; }
      else if (da === mio && a !== mio) { add(x, sim, -v); x.a = x.a || t.to; }
    });
    var out = [];
    Object.keys(per).forEach(function (k) {
      var x = per[k], ent = [], usc = [];
      Object.keys(x.var).forEach(function (s) { if (x.var[s] > 0n) ent.push([s, x.var[s]]); else if (x.var[s] < 0n) usc.push([s, -x.var[s]]); });
      var base = function () { return { riga: 0, ts: x.ts, tipo: "", tag: "", valore: 0, valoreFee: 0, valutaValore: "EUR", descrizione: x.metodo ? "Metodo: " + x.metodo : "", walletDa: "", walletA: "", idDa: "", idA: "",
        txSrc: x.da || "", txDest: x.a || "", txHash: x.hash, piattaforma: nomeWallet, controvalore: null, fonteValore: "", voci: [] }; };
      var fee = x.fee, feeMessa = false, metti = function (m) { if (fee && !feeMessa) { m.voci.push({ valuta: nat, simbolo: nat, q: -fee, lato: "fee" }); m.walletDa = nomeWallet; feeMessa = true; } return m; };
      if (usc.length === 1 && ent.length === 1) {
        var m = base(); m.tipo = "trade"; m.walletDa = m.walletA = nomeWallet; m.descrizione = "Scambio on-chain" + (x.metodo ? " (" + x.metodo + ")" : "");
        m.voci.push({ valuta: usc[0][0], simbolo: usc[0][0], q: -usc[0][1], lato: "da" }, { valuta: ent[0][0], simbolo: ent[0][0], q: ent[0][1], lato: "a" });
        out.push(metti(m));
      } else {
        var piu = usc.length + ent.length > 1;
        usc.forEach(function (u) { var m = base(); m.tipo = "withdrawal"; m.walletDa = nomeWallet; m.voci.push({ valuta: u[0], simbolo: u[0], q: -u[1], lato: "da" }); m.descrizione = "Invio on-chain" + (piu ? " (transazione con più cripto: verificare)" : ""); out.push(metti(m)); });
        ent.forEach(function (e) { var m = base(); m.tipo = "deposit"; m.walletA = nomeWallet; m.voci.push({ valuta: e[0], simbolo: e[0], q: e[1], lato: "a" }); m.descrizione = "Ricezione on-chain" + (piu ? " (transazione con più cripto: verificare)" : ""); out.push(m); });
        if (fee && !feeMessa) { var c = base(); c.tipo = "withdrawal"; c.tag = "cost"; c.walletDa = nomeWallet; c.descrizione = "Commissione di rete" + (x.errore ? " (transazione non riuscita)" : x.metodo ? " (" + x.metodo + ")" : ""); c.voci.push({ valuta: nat, simbolo: nat, q: -fee, lato: "fee" }); out.push(c); }
      }
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    return { movimenti: out, spam: spam };
  }

  /* transazioni → movimenti del wallet (importi in satoshi → BTC con 8 decimali) */
  function movimenti(transazioni, miei, nomeWallet) {
    var sat = function (v) { return D.dec((v / 1e8).toFixed(8)); };
    var out = [];
    transazioni.filter(function (t) { return t.status && t.status.confirmed; }).forEach(function (t) {
      var entrate = 0, uscite = 0, tutti = true, origine = "", dest = "";
      t.vin.forEach(function (v) { var a = v.prevout && v.prevout.scriptpubkey_address; if (a && miei[a] != null) uscite += v.prevout.value; else { tutti = false; if (!origine && a) origine = a; } });
      t.vout.forEach(function (v) { var a = v.scriptpubkey_address; if (a && miei[a] != null) entrate += v.value; else if (!dest && a) dest = a; });
      var ts = t.status.block_time * 1000, base = { riga: 0, ts: ts, tipo: "", tag: "", valore: 0, valoreFee: 0, valutaValore: "EUR", descrizione: "", walletDa: "", walletA: "", idDa: "", idA: "",
        txSrc: "", txDest: "", txHash: t.txid, piattaforma: nomeWallet, controvalore: null, fonteValore: "", voci: [], blocco: t.status.block_height };
      if (uscite > 0) {
        // il cliente ha speso: la commissione è sua se tutti gli input sono suoi, altrimenti (transazione condivisa) si segnala
        var fee = tutti ? t.fee : 0, netto = uscite - entrate - fee;
        if (netto > 0) {
          base.tipo = "withdrawal"; base.walletDa = nomeWallet; base.txDest = dest; base.descrizione = "Invio on-chain" + (tutti ? "" : " (transazione con input di terzi: verificare)");
          base.voci.push({ valuta: "BTC", simbolo: "BTC", q: -sat(netto), lato: "da" });
          if (fee) base.voci.push({ valuta: "BTC", simbolo: "BTC", q: -sat(fee), lato: "fee" });
        } else if (netto < 0) {
          base.tipo = "deposit"; base.walletA = nomeWallet; base.txSrc = origine; base.descrizione = "Ricezione on-chain (transazione con input propri e di terzi)";
          base.voci.push({ valuta: "BTC", simbolo: "BTC", q: sat(-netto), lato: "a" });
        } else if (fee) {
          base.tipo = "withdrawal"; base.tag = "cost"; base.walletDa = nomeWallet; base.descrizione = "Invio a sé stesso: solo commissione di rete";
          base.voci.push({ valuta: "BTC", simbolo: "BTC", q: -sat(fee), lato: "fee" });
        } else return;
      } else if (entrate > 0) {
        base.tipo = "deposit"; base.walletA = nomeWallet; base.txSrc = origine; base.descrizione = "Ricezione on-chain";
        base.voci.push({ valuta: "BTC", simbolo: "BTC", q: sat(entrate), lato: "a" });
      } else return;
      out.push(base);
    });
    out.sort(function (a, b) { return a.ts - b.ts || (a.blocco || 0) - (b.blocco || 0); });
    return out;
  }

  /* elenco delle chiavi fornito dal cliente: «Portafoglio;Tipo;Chiave pubblica estesa» (anche separato da virgole) */
  function leggiElencoChiavi(testo) {
    var righe = String(testo).replace(/^﻿/, "").split(/\r?\n/).filter(function (r) { return r.trim(); });
    var sep = /;/.test(righe[0] || "") ? ";" : ",";
    return righe.slice(1).map(function (r) {
      var c = r.split(sep).map(function (x) { return x.trim(); });
      var chiave = c.filter(function (x) { return /^[xyzXYZt]pub[1-9A-HJ-NP-Za-km-z]{100,}$/.test(x); })[0];
      return chiave ? { wallet: c[0], tipo: c[1] || "", chiave: chiave } : null;
    }).filter(Boolean);
  }

  /* richieste prudenti ai servizi pubblici: una alla volta, con una pausa (mempool.space ~1 al secondo, Blockscout ~1 ogni 2),
     e attese crescenti se il servizio risponde «troppe richieste» (429) o è irraggiungibile; il risultato si conserva in cache */
  function creaRichiesta(opz) {
    opz = opz || {};
    var pausa = opz.pausa || 1100, tentativi = opz.tentativi || 8, attesa = opz.attesa || 20000, f = opz.fetch || (typeof fetch === "function" ? fetch : null), ultimo = 0;
    var dormi = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    return async function (url) {
      for (var k = 0; k < tentativi; k++) {
        var adesso = Date.now(); if (adesso - ultimo < pausa) await dormi(pausa - (adesso - ultimo)); ultimo = Date.now();
        var r;
        try { r = await f(url); } catch (e) { if (opz.avviso) opz.avviso("rete non raggiungibile, nuovo tentativo"); await dormi(attesa * (k + 1)); continue; }
        if (r.status === 429 || r.status >= 500) { if (opz.avviso) opz.avviso("il servizio chiede di rallentare (" + r.status + "), attesa di " + Math.round(attesa * (k + 1) / 1000) + " secondi"); await dormi(attesa * (k + 1)); continue; }
        if (!r.ok) throw new Error("Risposta " + r.status + " da " + url.split("?")[0]);
        return r.json();
      }
      throw new Error("Il servizio non risponde dopo " + tentativi + " tentativi: riprovare più tardi (i dati già letti restano in memoria).");
    };
  }

  /* chiavi che portano agli stessi indirizzi (es. la stessa chiave scritta come xpub e come zpub): si legge una volta sola */
  function chiaviUniche(elenco) {
    var visti = {}, out = [], doppie = [];
    elenco.forEach(function (w) {
      try { var k = leggiChiave(w.chiave), tipo = tipoIndirizzo(k.versione, w.tipo), a = deriva(k, tipo, 0, 0); }
      catch (e) { doppie.push({ wallet: w.wallet, errore: e.message }); return; }
      if (visti[a]) { doppie.push({ wallet: w.wallet, ugualeA: visti[a] }); return; }
      visti[a] = w.wallet; out.push(Object.assign({}, w, { tipoIndirizzo: tipo, primo: a }));
    });
    return { chiavi: out, scartate: doppie };
  }

  return { leggiChiave: leggiChiave, chiaviUniche: chiaviUniche, creaRichiesta: creaRichiesta, leggiIndirizzi: leggiIndirizzi, leggiEvm: leggiEvm, movimentiEvm: movimentiEvm, tokenSpam: tokenSpam, RETI: RETI, deriva: deriva, tipoIndirizzo: tipoIndirizzo, indirizzo: indirizzo, leggiWallet: leggiWallet, movimenti: movimenti, leggiElencoChiavi: leggiElencoChiavi,
    sha256: sha256, sha512: sha512, ripemd160: ripemd160, hex: hex, utf8: utf8, API: API };
});

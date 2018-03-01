// nano-webgl-pow
// Nano Currency Proof of Work Value generation using WebGL
// Author:  numtel <ben@latenightsketches.com>
// License: MIT

// window.NanoWebglPow(hashHex, callback, progressCallback);
// @param hashHex           String   Previous Block Hash as Hex String
// @param callback          Function Called when work value found
//   Receives single string argument, work value as hex
// @param progressCallback  Function Optional
//   Receives single argument: n, number of frames so far
//   Return true to abort

(function(){

const BLAKE2B_IV_MOD = new Int32Array([
  0,201,189,242,103,230,9,106,59,167,202,132,133,174,103,187,43,248,148,254,
  114,243,110,60,241,54,29,95,58,245,79,165,209,130,230,173,127,82,14,81,31,
  108,62,43,140,104,5,155,107,189,65,251,171,217,131,31,121,33,126,19,25,205,
  224,91,8,201,188,243,103,230,9,106,59,167,202,132,133,174,103,187,43,248,
  148,254,114,243,110,60,241,54,29,95,58,245,79,165,249,130,230,173,127,82,
  14,81,31,108,62,43,140,104,5,155,148,66,190,4,84,38,124,224,121,33,126,19,
  25,205,224,91
]);

function array_hex(arr, index, length) {
  let out='';
  for(let i=length - 1;i>-1;i--) {
    out+=(arr[i] > 15 ? '' : '0') + arr[i].toString(16);
  }
  return out;
}

function hex_reverse(hex) {
  let out='';
  for(let i=hex.length;i>0;i-=2) {
    out+=hex.slice(i-2,i);
  }
  return out;
}

function calculate(hashHex, callback, progressCallback) {
  const canvas = document.getElementById('canvas');

  canvas.width = window.NanoWebglPow.width;
  canvas.height = window.NanoWebglPow.height;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if(!gl)
    throw new Error('webgl_required');

  if(!/^[A-F-a-f0-9]{64}$/.test(hashHex))
    throw new Error('invalid_hash');

  gl.clearColor(0, 0, 0, 1);

  const reverseHex = hex_reverse(hashHex);

  // Vertex Shader
  const vsSource = `
    attribute vec2 pos;
    attribute vec2 uv;

    varying vec2 uv_pos;

    void main() {
      uv_pos = uv;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  // Fragment shader
  const fsSource = `
    #ifdef GL_ES
    precision mediump float;
    precision mediump int;
    #endif

    uniform int u_work[6];
    uniform int u_hash[32];
    uniform int u_iv[128];

    varying vec2 uv_pos;

    float v_buf[128]; // 16 x 64-bit, 1 byte per float
    float m_buf[128];

#define XOR8(a, b) \
  byt1 = v_buf[a]; \
  byt2 = v_buf[b]; \
  working = 0.; \
  for(int bit=0;bit<8;bit++) { \
    bit1 = mod(byt1, 2.); \
    bit2 = mod(byt2, 2.); \
    if(bit1 != bit2 && (bit1 == 1. || bit2 == 1.)) { \
      working += pow(2., float(bit)); \
    } \
    byt1 = (byt1 - bit1) / 2.; \
    byt2 = (byt2 - bit2) / 2.; \
  } \
  v_buf[a] = working; \

#define XOR64(a, b) \
  XOR8((a * 8) + 0, (b * 8) + 0); \
  XOR8((a * 8) + 1, (b * 8) + 1); \
  XOR8((a * 8) + 2, (b * 8) + 2); \
  XOR8((a * 8) + 3, (b * 8) + 3); \
  XOR8((a * 8) + 4, (b * 8) + 4); \
  XOR8((a * 8) + 5, (b * 8) + 5); \
  XOR8((a * 8) + 6, (b * 8) + 6); \
  XOR8((a * 8) + 7, (b * 8) + 7); \

#define ADD8(a, b, carry) \
  working = v_buf[a] + v_buf[b]; \
  if(working > 255.) { \
    if(carry) v_buf[a + 1]++; \
    working -= 256.; \
  } \
  v_buf[a] = working; \

#define ADD64(a, b) \
  ADD8((a * 8) + 0, (b * 8) + 0, true); \
  ADD8((a * 8) + 1, (b * 8) + 1, true); \
  ADD8((a * 8) + 2, (b * 8) + 2, true); \
  ADD8((a * 8) + 3, (b * 8) + 3, true); \
  ADD8((a * 8) + 4, (b * 8) + 4, true); \
  ADD8((a * 8) + 5, (b * 8) + 5, true); \
  ADD8((a * 8) + 6, (b * 8) + 6, true); \
  ADD8((a * 8) + 7, (b * 8) + 7, false); \

#define SIGMA8(x, off) \
  if(x==0) working = m_buf[(0 * 8) + off]; \
  if(x==1) working = m_buf[(1 * 8) + off]; \
  if(x==2) working = m_buf[(2 * 8) + off]; \
  if(x==3) working = m_buf[(3 * 8) + off]; \
  if(x==4) working = m_buf[(4 * 8) + off]; \
  if(x==5) working = m_buf[(5 * 8) + off]; \
  if(x==6) working = m_buf[(6 * 8) + off]; \
  if(x==7) working = m_buf[(7 * 8) + off]; \
  if(x==8) working = m_buf[(8 * 8) + off]; \
  if(x==9) working = m_buf[(9 * 8) + off]; \
  if(x==10) working = m_buf[(10 * 8) + off]; \
  if(x==11) working = m_buf[(11 * 8) + off]; \
  if(x==12) working = m_buf[(12 * 8) + off]; \
  if(x==13) working = m_buf[(13 * 8) + off]; \
  if(x==14) working = m_buf[(14 * 8) + off]; \
  if(x==15) working = m_buf[(15 * 8) + off]; \
  if(x==16) working = m_buf[(14 * 8) + off]; \
  if(x==17) working = m_buf[(10 * 8) + off]; \
  if(x==18) working = m_buf[(4 * 8) + off]; \
  if(x==19) working = m_buf[(8 * 8) + off]; \
  if(x==20) working = m_buf[(9 * 8) + off]; \
  if(x==21) working = m_buf[(15 * 8) + off]; \
  if(x==22) working = m_buf[(13 * 8) + off]; \
  if(x==23) working = m_buf[(6 * 8) + off]; \
  if(x==24) working = m_buf[(1 * 8) + off]; \
  if(x==25) working = m_buf[(12 * 8) + off]; \
  if(x==26) working = m_buf[(0 * 8) + off]; \
  if(x==27) working = m_buf[(2 * 8) + off]; \
  if(x==28) working = m_buf[(11 * 8) + off]; \
  if(x==29) working = m_buf[(7 * 8) + off]; \
  if(x==30) working = m_buf[(5 * 8) + off]; \
  if(x==31) working = m_buf[(3 * 8) + off]; \
  if(x==32) working = m_buf[(11 * 8) + off]; \
  if(x==33) working = m_buf[(8 * 8) + off]; \
  if(x==34) working = m_buf[(12 * 8) + off]; \
  if(x==35) working = m_buf[(0 * 8) + off]; \
  if(x==36) working = m_buf[(5 * 8) + off]; \
  if(x==37) working = m_buf[(2 * 8) + off]; \
  if(x==38) working = m_buf[(15 * 8) + off]; \
  if(x==39) working = m_buf[(13 * 8) + off]; \
  if(x==40) working = m_buf[(10 * 8) + off]; \
  if(x==41) working = m_buf[(14 * 8) + off]; \
  if(x==42) working = m_buf[(3 * 8) + off]; \
  if(x==43) working = m_buf[(6 * 8) + off]; \
  if(x==44) working = m_buf[(7 * 8) + off]; \
  if(x==45) working = m_buf[(1 * 8) + off]; \
  if(x==46) working = m_buf[(9 * 8) + off]; \
  if(x==47) working = m_buf[(4 * 8) + off]; \
  if(x==48) working = m_buf[(7 * 8) + off]; \
  if(x==49) working = m_buf[(9 * 8) + off]; \
  if(x==50) working = m_buf[(3 * 8) + off]; \
  if(x==51) working = m_buf[(1 * 8) + off]; \
  if(x==52) working = m_buf[(13 * 8) + off]; \
  if(x==53) working = m_buf[(12 * 8) + off]; \
  if(x==54) working = m_buf[(11 * 8) + off]; \
  if(x==55) working = m_buf[(14 * 8) + off]; \
  if(x==56) working = m_buf[(2 * 8) + off]; \
  if(x==57) working = m_buf[(6 * 8) + off]; \
  if(x==58) working = m_buf[(5 * 8) + off]; \
  if(x==59) working = m_buf[(10 * 8) + off]; \
  if(x==60) working = m_buf[(4 * 8) + off]; \
  if(x==61) working = m_buf[(0 * 8) + off]; \
  if(x==62) working = m_buf[(15 * 8) + off]; \
  if(x==63) working = m_buf[(8 * 8) + off]; \
  if(x==64) working = m_buf[(9 * 8) + off]; \
  if(x==65) working = m_buf[(0 * 8) + off]; \
  if(x==66) working = m_buf[(5 * 8) + off]; \
  if(x==67) working = m_buf[(7 * 8) + off]; \
  if(x==68) working = m_buf[(2 * 8) + off]; \
  if(x==69) working = m_buf[(4 * 8) + off]; \
  if(x==70) working = m_buf[(10 * 8) + off]; \
  if(x==71) working = m_buf[(15 * 8) + off]; \
  if(x==72) working = m_buf[(14 * 8) + off]; \
  if(x==73) working = m_buf[(1 * 8) + off]; \
  if(x==74) working = m_buf[(11 * 8) + off]; \
  if(x==75) working = m_buf[(12 * 8) + off]; \
  if(x==76) working = m_buf[(6 * 8) + off]; \
  if(x==77) working = m_buf[(8 * 8) + off]; \
  if(x==78) working = m_buf[(3 * 8) + off]; \
  if(x==79) working = m_buf[(13 * 8) + off]; \
  if(x==80) working = m_buf[(2 * 8) + off]; \
  if(x==81) working = m_buf[(12 * 8) + off]; \
  if(x==82) working = m_buf[(6 * 8) + off]; \
  if(x==83) working = m_buf[(10 * 8) + off]; \
  if(x==84) working = m_buf[(0 * 8) + off]; \
  if(x==85) working = m_buf[(11 * 8) + off]; \
  if(x==86) working = m_buf[(8 * 8) + off]; \
  if(x==87) working = m_buf[(3 * 8) + off]; \
  if(x==88) working = m_buf[(4 * 8) + off]; \
  if(x==89) working = m_buf[(13 * 8) + off]; \
  if(x==90) working = m_buf[(7 * 8) + off]; \
  if(x==91) working = m_buf[(5 * 8) + off]; \
  if(x==92) working = m_buf[(15 * 8) + off]; \
  if(x==93) working = m_buf[(14 * 8) + off]; \
  if(x==94) working = m_buf[(1 * 8) + off]; \
  if(x==95) working = m_buf[(9 * 8) + off]; \
  if(x==96) working = m_buf[(12 * 8) + off]; \
  if(x==97) working = m_buf[(5 * 8) + off]; \
  if(x==98) working = m_buf[(1 * 8) + off]; \
  if(x==99) working = m_buf[(15 * 8) + off]; \
  if(x==100) working = m_buf[(14 * 8) + off]; \
  if(x==101) working = m_buf[(13 * 8) + off]; \
  if(x==102) working = m_buf[(4 * 8) + off]; \
  if(x==103) working = m_buf[(10 * 8) + off]; \
  if(x==104) working = m_buf[(0 * 8) + off]; \
  if(x==105) working = m_buf[(7 * 8) + off]; \
  if(x==106) working = m_buf[(6 * 8) + off]; \
  if(x==107) working = m_buf[(3 * 8) + off]; \
  if(x==108) working = m_buf[(9 * 8) + off]; \
  if(x==109) working = m_buf[(2 * 8) + off]; \
  if(x==110) working = m_buf[(8 * 8) + off]; \
  if(x==111) working = m_buf[(11 * 8) + off]; \
  if(x==112) working = m_buf[(13 * 8) + off]; \
  if(x==113) working = m_buf[(11 * 8) + off]; \
  if(x==114) working = m_buf[(7 * 8) + off]; \
  if(x==115) working = m_buf[(14 * 8) + off]; \
  if(x==116) working = m_buf[(12 * 8) + off]; \
  if(x==117) working = m_buf[(1 * 8) + off]; \
  if(x==118) working = m_buf[(3 * 8) + off]; \
  if(x==119) working = m_buf[(9 * 8) + off]; \
  if(x==120) working = m_buf[(5 * 8) + off]; \
  if(x==121) working = m_buf[(0 * 8) + off]; \
  if(x==122) working = m_buf[(15 * 8) + off]; \
  if(x==123) working = m_buf[(4 * 8) + off]; \
  if(x==124) working = m_buf[(8 * 8) + off]; \
  if(x==125) working = m_buf[(6 * 8) + off]; \
  if(x==126) working = m_buf[(2 * 8) + off]; \
  if(x==127) working = m_buf[(10 * 8) + off]; \
  if(x==128) working = m_buf[(6 * 8) + off]; \
  if(x==129) working = m_buf[(15 * 8) + off]; \
  if(x==130) working = m_buf[(14 * 8) + off]; \
  if(x==131) working = m_buf[(9 * 8) + off]; \
  if(x==132) working = m_buf[(11 * 8) + off]; \
  if(x==133) working = m_buf[(3 * 8) + off]; \
  if(x==134) working = m_buf[(0 * 8) + off]; \
  if(x==135) working = m_buf[(8 * 8) + off]; \
  if(x==136) working = m_buf[(12 * 8) + off]; \
  if(x==137) working = m_buf[(2 * 8) + off]; \
  if(x==138) working = m_buf[(13 * 8) + off]; \
  if(x==139) working = m_buf[(7 * 8) + off]; \
  if(x==140) working = m_buf[(1 * 8) + off]; \
  if(x==141) working = m_buf[(4 * 8) + off]; \
  if(x==142) working = m_buf[(10 * 8) + off]; \
  if(x==143) working = m_buf[(5 * 8) + off]; \
  if(x==144) working = m_buf[(10 * 8) + off]; \
  if(x==145) working = m_buf[(2 * 8) + off]; \
  if(x==146) working = m_buf[(8 * 8) + off]; \
  if(x==147) working = m_buf[(4 * 8) + off]; \
  if(x==148) working = m_buf[(7 * 8) + off]; \
  if(x==149) working = m_buf[(6 * 8) + off]; \
  if(x==150) working = m_buf[(1 * 8) + off]; \
  if(x==151) working = m_buf[(5 * 8) + off]; \
  if(x==152) working = m_buf[(15 * 8) + off]; \
  if(x==153) working = m_buf[(11 * 8) + off]; \
  if(x==154) working = m_buf[(9 * 8) + off]; \
  if(x==155) working = m_buf[(14 * 8) + off]; \
  if(x==156) working = m_buf[(3 * 8) + off]; \
  if(x==157) working = m_buf[(12 * 8) + off]; \
  if(x==158) working = m_buf[(13 * 8) + off]; \
  if(x==159) working = m_buf[(0 * 8) + off]; \
  if(x==160) working = m_buf[(0 * 8) + off]; \
  if(x==161) working = m_buf[(1 * 8) + off]; \
  if(x==162) working = m_buf[(2 * 8) + off]; \
  if(x==163) working = m_buf[(3 * 8) + off]; \
  if(x==164) working = m_buf[(4 * 8) + off]; \
  if(x==165) working = m_buf[(5 * 8) + off]; \
  if(x==166) working = m_buf[(6 * 8) + off]; \
  if(x==167) working = m_buf[(7 * 8) + off]; \
  if(x==168) working = m_buf[(8 * 8) + off]; \
  if(x==169) working = m_buf[(9 * 8) + off]; \
  if(x==170) working = m_buf[(10 * 8) + off]; \
  if(x==171) working = m_buf[(11 * 8) + off]; \
  if(x==172) working = m_buf[(12 * 8) + off]; \
  if(x==173) working = m_buf[(13 * 8) + off]; \
  if(x==174) working = m_buf[(14 * 8) + off]; \
  if(x==175) working = m_buf[(15 * 8) + off]; \
  if(x==176) working = m_buf[(14 * 8) + off]; \
  if(x==177) working = m_buf[(10 * 8) + off]; \
  if(x==178) working = m_buf[(4 * 8) + off]; \
  if(x==179) working = m_buf[(8 * 8) + off]; \
  if(x==180) working = m_buf[(9 * 8) + off]; \
  if(x==181) working = m_buf[(15 * 8) + off]; \
  if(x==182) working = m_buf[(13 * 8) + off]; \
  if(x==183) working = m_buf[(6 * 8) + off]; \
  if(x==184) working = m_buf[(1 * 8) + off]; \
  if(x==185) working = m_buf[(12 * 8) + off]; \
  if(x==186) working = m_buf[(0 * 8) + off]; \
  if(x==187) working = m_buf[(2 * 8) + off]; \
  if(x==188) working = m_buf[(11 * 8) + off]; \
  if(x==189) working = m_buf[(7 * 8) + off]; \
  if(x==190) working = m_buf[(5 * 8) + off]; \
  if(x==191) working = m_buf[(3 * 8) + off]; \

#define SIGMA(r, i, off, byteOff) SIGMA8(r*16 + i*2 + off, byteOff)

#define ADD8_M(a, b, carry) \
  working = v_buf[a] + b; \
  if(working > 255.) { \
    if(carry) v_buf[a + 1]++; \
    working -= 256.; \
  } \
  v_buf[a] = working; \

#define ADD64_M(a, r, i, off) \
  SIGMA(r, i, off, 0); \
  ADD8_M(a+0, working, true) \
  SIGMA(r, i, off, 1); \
  ADD8_M(a+1, working, true) \
  SIGMA(r, i, off, 2); \
  ADD8_M(a+2, working, true) \
  SIGMA(r, i, off, 3); \
  ADD8_M(a+3, working, true) \
  SIGMA(r, i, off, 4); \
  ADD8_M(a+4, working, true) \
  SIGMA(r, i, off, 5); \
  ADD8_M(a+5, working, true) \
  SIGMA(r, i, off, 6); \
  ADD8_M(a+6, working, true) \
  SIGMA(r, i, off, 7); \
  ADD8_M(a+7, working, false) \

#define ROTATE32(a) \
  rotbuf[0] = v_buf[(a * 8)]; \
  rotbuf[1] = v_buf[(a * 8)+1]; \
  rotbuf[2] = v_buf[(a * 8)+2]; \
  rotbuf[3] = v_buf[(a * 8)+3]; \
  v_buf[(a * 8)] = v_buf[(a * 8)+4]; \
  v_buf[(a * 8)+1] = v_buf[(a * 8)+5]; \
  v_buf[(a * 8)+2] = v_buf[(a * 8)+6]; \
  v_buf[(a * 8)+3] = v_buf[(a * 8)+7]; \
  v_buf[(a * 8)+4] = rotbuf[0]; \
  v_buf[(a * 8)+5] = rotbuf[1]; \
  v_buf[(a * 8)+6] = rotbuf[2]; \
  v_buf[(a * 8)+7] = rotbuf[3]; \

#define ROTATE24(a) \
  rotbuf[0] = v_buf[(a * 8)+5]; \
  rotbuf[1] = v_buf[(a * 8)+6]; \
  rotbuf[2] = v_buf[(a * 8)+7]; \
  v_buf[(a * 8)+7] = v_buf[(a * 8)+4]; \
  v_buf[(a * 8)+6] = v_buf[(a * 8)+3]; \
  v_buf[(a * 8)+5] = v_buf[(a * 8)+2]; \
  v_buf[(a * 8)+4] = v_buf[(a * 8)+1]; \
  v_buf[(a * 8)+3] = v_buf[(a * 8)+0]; \
  v_buf[(a * 8)+2] = rotbuf[2]; \
  v_buf[(a * 8)+1] = rotbuf[1]; \
  v_buf[(a * 8)+0] = rotbuf[0]; \

#define ROTATE16(a) \
  rotbuf[0] = v_buf[(a * 8)+6]; \
  rotbuf[1] = v_buf[(a * 8)+7]; \
  v_buf[(a * 8)+7] = v_buf[(a * 8)+5]; \
  v_buf[(a * 8)+6] = v_buf[(a * 8)+4]; \
  v_buf[(a * 8)+5] = v_buf[(a * 8)+3]; \
  v_buf[(a * 8)+4] = v_buf[(a * 8)+2]; \
  v_buf[(a * 8)+3] = v_buf[(a * 8)+1]; \
  v_buf[(a * 8)+2] = v_buf[(a * 8)+0]; \
  v_buf[(a * 8)+1] = rotbuf[1]; \
  v_buf[(a * 8)+0] = rotbuf[0]; \

#define ROTATE63(a) \
  bit1 = mod(v_buf[(a * 8) +7], 2.); \
  bit2 = mod(v_buf[(a * 8) +0], 2.); \
  v_buf[(a*8) + 0] = (v_buf[(a*8) + 0] - bit2) / 2. + bit1 * 128.; \
  bit1 = mod(v_buf[(a * 8) +1], 2.); \
  v_buf[(a*8) + 1] = (v_buf[(a*8) + 1] - bit1) / 2. + bit2 * 128.; \
  bit2 = mod(v_buf[(a * 8) +2], 2.); \
  v_buf[(a*8) + 2] = (v_buf[(a*8) + 2] - bit2) / 2. + bit1 * 128.; \
  bit1 = mod(v_buf[(a * 8) +3], 2.); \
  v_buf[(a*8) + 3] = (v_buf[(a*8) + 3] - bit1) / 2. + bit2 * 128.; \
  bit2 = mod(v_buf[(a * 8) +4], 2.); \
  v_buf[(a*8) + 4] = (v_buf[(a*8) + 4] - bit2) / 2. + bit1 * 128.; \
  bit1 = mod(v_buf[(a * 8) +5], 2.); \
  v_buf[(a*8) + 5] = (v_buf[(a*8) + 5] - bit1) / 2. + bit2 * 128.; \
  bit2 = mod(v_buf[(a * 8) +6], 2.); \
  v_buf[(a*8) + 6] = (v_buf[(a*8) + 6] - bit2) / 2. + bit1 * 128.; \
  bit1 = mod(v_buf[(a * 8) +7], 2.); \
  v_buf[(a*8) + 7] = (v_buf[(a*8) + 7] - bit1) / 2. + bit2 * 128.; \

    void main() {
      // Buffer registers for macros
      float byt1, byt2, bit1, bit2, working;
      float rotbuf[4];

      // Initialize context
      for(int i=0;i<128;i++) {
        v_buf[i] = float(u_iv[i]);
        if(i>1 && i<8) m_buf[i] = float(u_work[i-2]);
        if(i>7 && i<40) m_buf[i] = float(u_hash[i-8]);
      }
//       XOR64(2,5);
//       ADD64(2,5);
//       ADD64_M(2,11,7,1);
//       SIGMA(0,0,0,1);
//       ROTATE63(0);
      gl_FragColor = vec4(uv_pos.r,m_buf[2]/255.,v_buf[1]/255.,v_buf[127]/255.);
    }
  `;

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);

  if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
    throw gl.getShaderInfoLog(vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
    throw gl.getShaderInfoLog(fragmentShader);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw gl.getProgramInfoLog(program);

  gl.useProgram(program);

  // Construct simple 2D geometry
//   const triangleArray = gl.createVertexArray();
//   gl.bindVertexArray(triangleArray);

  // Vertex Positions, 2 triangles
  const positions = new Float32Array([
    -1,-1,0, -1,1,0, 1,1,0,
    1,-1,0, 1,1,0, -1,-1,0
  ]);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'pos');
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  // Texture Positions
  const uvPosArray = new Float32Array([
    1,1, 1,0, 0,0,   0,1, 0,0, 1,1
  ]);
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvPosArray, gl.STATIC_DRAW);
  const uvLocation = gl.getAttribLocation(program, 'uv');
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);

  const workLocation = gl.getUniformLocation(program, 'u_work');
  const work = new Int32Array([1,35,255,224,4,5]);

  const ivLocation = gl.getUniformLocation(program, 'u_iv');
  gl.uniform1iv(ivLocation, BLAKE2B_IV_MOD);

  const hashLocation = gl.getUniformLocation(program, 'u_hash');
  const hash = new Int32Array([
    26, 102, 165, 206, 245, 177, 73, 254,
    174, 143, 104, 14, 215, 227, 41, 86,
    243, 180, 90, 61, 121, 20, 102, 2,
    101, 23, 139, 222, 209, 100, 70, 200
  ]);
  gl.uniform1iv(hashLocation, hash);

  // Draw output until success or progressCallback says to stop
  let n=0;

  function draw() {
    n++;
//     window.crypto.getRandomValues(work);
     gl.uniform1iv(workLocation,work);

    // Check with progressCallback every 100 frames
    if(n%100===0 && typeof progressCallback === 'function' && progressCallback(n))
      return;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    setStatus(pixels.slice(0,10).join(','));
console.log(pixels);

    // Check the pixels for any success
//     for(let i=0;i<pixels.length;i+=4) {
//       if(pixels[i] !== 0) {
//         // Return the work value with the custom bits
//         typeof callback === 'function' &&
//           callback(
//             array_hex(work1, 0, 4) +
//             array_hex([
//               pixels[i+2],
//               pixels[i+3],
//               work0[2] ^ (pixels[i]-1),
//               work0[3] ^ (pixels[i+1]-1)
//             ], 0, 4), n);
//         return;
//       }
//     }
    // Nothing found yet, try again
    //window.requestAnimationFrame(draw);
  }

  // Begin generation
  window.requestAnimationFrame(draw);
}

window.NanoWebglPow = calculate;
// Both width and height must be multiple of 256, (one byte)
// but do not need to be the same,
// matching GPU capabilities is the aim
window.NanoWebglPow.width = 256 * 1;
window.NanoWebglPow.height = 256 * 1;

})();

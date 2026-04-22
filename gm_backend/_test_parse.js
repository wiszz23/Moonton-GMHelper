const { Client } = require('pg');
async function main() {
  const c = new Client({host:'10.30.138.5',port:5432,user:'qa',password:'qa',database:'gm_webtool'});
  await c.connect();
  const r = await c.query(`SELECT commands FROM userdata WHERE owner = $1`, ['王俊琦(Junqi)']);
  await c.end();
  const raw = r.rows[0].commands;

  // Find all control characters in raw
  const ctrlChars = [];
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 32) ctrlChars.push({pos: i, code, char: raw[i]});
  }
  console.log('Control chars in raw:', ctrlChars.slice(0, 10));
  console.log('Control char codes:', [...new Set(ctrlChars.map(x => x.code))]);

  // Fix "" -> \" and also replace raw control chars with unicode escapes
  // JSON only allows \t \r \n \f as escapes; others must be \uXXXX
  let fixed = raw.replace(/""/g, '\\"');
  // Replace raw control chars (but preserve \t, \r, \n which we'll handle separately)
  fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  // Replace raw \n (0x0A) and \r (0x0D) with escaped forms
  fixed = fixed.replace(/\x0A/g, '\\n');
  fixed = fixed.replace(/\x0D/g, '\\r');
  fixed = fixed.replace(/\x09/g, '\\t');

  const step1 = JSON.parse(fixed);
  console.log('Step1 type:', typeof step1, '| length:', step1.length);

  if (typeof step1 === 'string') {
    console.log('Step1 first 20:', JSON.stringify(step1.substring(0, 20)));
    let step1fixed = step1.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
      c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    step1fixed = step1fixed.replace(/\x0A/g, '\\n');
    step1fixed = step1fixed.replace(/\x0D/g, '\\r');
    step1fixed = step1fixed.replace(/\x09/g, '\\t');
    const step2 = JSON.parse(step1fixed);
    console.log('Step2 type:', typeof step2, '| length:', Array.isArray(step2) ? step2.length : 'N/A');
    if (Array.isArray(step2)) {
      const cats = [...new Set(step2.map(x => x.category).filter(Boolean))];
      console.log('Categories:', cats);
      console.log('SUCCESS - commands count:', step2.length);
    }
  } else if (Array.isArray(step1)) {
    console.log('Already an array, commands:', step1.length);
  }
}
main().catch(console.error);

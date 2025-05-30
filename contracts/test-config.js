require("dotenv").config();

console.log("Private key from env:", process.env.PRIVATE_KEY);
console.log("Private key length:", process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.length : 'undefined');
console.log("Starts with 0x:", process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.startsWith('0x') : 'undefined');

// Check if it's a valid hex string
if (process.env.PRIVATE_KEY) {
  const pk = process.env.PRIVATE_KEY;
  const hexPart = pk.startsWith('0x') ? pk.slice(2) : pk;
  console.log("Hex part length:", hexPart.length);
  console.log("Is valid hex:", /^[0-9a-fA-F]+$/.test(hexPart));
}
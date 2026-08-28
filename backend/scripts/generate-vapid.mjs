import { generateVapidKeys } from "@mmmike/web-push/vapid";

const { publicKey, privateKey } = await generateVapidKeys();

console.log(JSON.stringify({
  publicKey,
  privateKey,
  subject: "mailto:admin@abunizar963.github.io",
}, null, 2));

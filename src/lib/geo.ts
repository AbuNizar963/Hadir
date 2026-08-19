// في ملف attendance.ts
import { haversineMeters, isLikelyMockedPosition } from "@/lib/geo"; 

// وعند الاستخدام تأكد من استخدام await إذا لزم الأمر:
const check = await isLikelyMockedPosition({ lat: pos.lat, lng: pos.lng });

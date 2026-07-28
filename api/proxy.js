// api/proxy.js
export default async function handler(req, res) {
    // الرابط الجديد الذي قمت بتحويله من بيانات Stalker (يعمل بنسبة 100%)
    const M3U_URL = "http://4k.tvstb.me:80/get.php?username=1&2%20CB8F3108A1E319725C7955F70EE1394BF44D6E17ACA4F30CF947F1DFD7417E0C&password=1&2%20CB8F3108A1E319725C7955F70EE1394BF44D6E17ACA4F30CF947F1DFD7417E0C&type=m3u_plus";

    try {
        const response = await fetch(M3U_URL);
        const data = await response.text();
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('فشل الاتصال بالسيرفر');
    }
}

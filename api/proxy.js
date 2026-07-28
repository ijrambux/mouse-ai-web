// api/proxy.js
export default async function handler(req, res) {
    // قراءة الرابط الذي يرسله المتصفح
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('يرجى إرسال رابط M3U في الرابط');
    }

    try {
        const response = await fetch(url);
        const data = await response.text();
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('فشل الاتصال بالسيرفر');
    }
}

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('يرجى إرسال رابط M3U');
    }

    try {
        // مهلة زمنية 20 ثانية لتجنب التوقف للأبد
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.text();
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('فشل الاتصال بالسيرفر');
    }
}

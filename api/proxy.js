// api/proxy.js (هذا الملف هو من سيجلب القنوات نيابة عنك)
export default async function handler(req, res) {
    // رابط الـ M3U الخاص بك
    const M3U_URL = "http://melones.bollo.hofcepesp1.top:8080/get.php?username=ES0129178155217538&password=qfkt3nxdc5px&type=m3u_plus";

    try {
        // نقوم بجلب القنوات من الخادم مباشرة (ليس عبر المتصفح)
        const response = await fetch(M3U_URL);
        const data = await response.text();

        // إرسال البيانات للمتصفح مع الرؤوس الصحيحة
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('فشل الاتصال بالسيرفر');
    }
}

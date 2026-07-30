// ============================================================
//  MOUSE AI IPTV PRO - Proxy Server with CORS Fix
//  حل مشكلة HTTP 403 و CORS نهائياً
// ============================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['*']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===== PROXY ENDPOINT =====
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ 
            error: 'Missing url parameter',
            usage: '/proxy?url=https://example.com/playlist.m3u'
        });
    }

    console.log(`🔄 Proxying: ${url}`);

    try {
        const response = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                'Connection': 'keep-alive',
                'Referer': 'https://www.google.com/',
                'Origin': 'https://www.google.com'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });

        // Check if response is HTML (error page)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html') && !url.includes('.m3u')) {
            console.warn('⚠️ Received HTML instead of M3U data');
            return res.status(403).json({
                error: 'Server returned HTML page - Access Denied',
                message: 'The server is blocking our request. Try using a different server URL.'
            });
        }

        // Set response headers
        res.setHeader('Content-Type', response.headers['content-type'] || 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Cache-Control', 'no-cache');
        
        console.log(`✅ Proxy success: ${url} (${response.data.length} bytes)`);
        res.send(response.data);

    } catch (error) {
        console.error(`❌ Proxy error:`, error.message);
        
        let errorMessage = 'Proxy request failed';
        let statusCode = 500;

        if (error.response) {
            statusCode = error.response.status;
            errorMessage = `Server responded with ${error.response.status}`;
            
            if (error.response.status === 403) {
                errorMessage = '⛔ Access Forbidden (403) - The server is blocking access. Try a different URL or use a VPN.';
            } else if (error.response.status === 404) {
                errorMessage = '❌ Not Found (404) - The URL does not exist. Check your server address.';
            } else if (error.response.status === 401) {
                errorMessage = '🔒 Unauthorized (401) - Authentication required. Check your username/password.';
            }
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = '⏱️ Connection timeout - Server took too long to respond.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '🌐 DNS error - Server address not found. Check the URL.';
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: error.message
        });
    }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ===== TEST PROXY =====
app.get('/test-proxy', async (req, res) => {
    const testUrl = 'http://line.watchtivo-8k.com:80/play/live.php?mac=A0:BB:3E:18:9E:02&stream=686148&extension=ts';
    
    try {
        const response = await axios({
            method: 'GET',
            url: testUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            timeout: 10000
        });
        
        res.json({
            success: true,
            status: response.status,
            dataLength: response.data.length,
            contentType: response.headers['content-type']
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ===== SERVE MAIN PAGE =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log('\n🐭 MOUSE AI IPTV PRO Server');
    console.log('═══════════════════════════════════');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🔗 Proxy URL: http://localhost:${PORT}/proxy?url=`);
    console.log(`🧪 Test proxy: http://localhost:${PORT}/test-proxy`);
    console.log('═══════════════════════════════════\n');
});

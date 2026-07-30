// ============================================================
//  MOUSE AI IPTV Proxy Server
//  حل مشاكل CORS لتشغيل القنوات
// ============================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Proxy endpoint
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        console.log(`🔄 Proxying: ${url}`);
        
        const response = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            timeout: 30000,
            responseType: 'text'
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(response.data);
        
        console.log(`✅ Proxy success: ${url}`);
    } catch (error) {
        console.error(`❌ Proxy error: ${error.message}`);
        res.status(500).json({ 
            error: 'Proxy request failed',
            message: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🐭 MOUSE AI Proxy Server running on port ${PORT}`);
    console.log(`📡 Proxy URL: http://localhost:${PORT}/proxy?url=`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
});

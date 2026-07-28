<?php
// بيانات الاتصال بالسيرفر الخاص بك
$host = "melones.bollo.hofcepesp1.top";
$port = "8080";
$username = "ES0129178155217538";
$password = "qfkt3nxdc5px";

// رابط الـ M3U الخاص بك الذي سيجلب القنوات
$m3u_url = "http://$host:$port/get.php?username=$username&password=$password&type=m3u_plus";

function getChannels() {
    global $m3u_url;
    $content = @file_get_contents($m3u_url);
    if (!$content) return [];
    
    $lines = explode("\n", $content);
    $channels = [];
    $current = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '#EXTINF:') === 0) {
            // استخراج اسم القناة
            $parts = explode(',', $line);
            $name = end($parts);
            
            // استخراج الشعار (Logo)
            preg_match('/tvg-logo="(.*?)"/', $line, $logoMatch);
            $logo = isset($logoMatch[1]) ? $logoMatch[1] : '';
            
            // استخراج المجموعة (Group)
            preg_match('/group-title="(.*?)"/', $line, $groupMatch);
            $group = isset($groupMatch[1]) ? $groupMatch[1] : 'أخرى';
            
            $current = ['name' => $name, 'logo' => $logo, 'group' => $group];
        } elseif (strpos($line, 'http') === 0 && !empty($current)) {
            $current['url'] = $line;
            $channels[] = $current;
            $current = [];
        }
    }
    return $channels;
}
?>

<?php
include 'connect.php';

// إذا تم إرسال النموذج (نشر مقال جديد)
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['publish'])) {
    $title = $_POST['title'];
    $content = $_POST['content'];
    
    if (!empty($title) && !empty($content)) {
        $stmt = $conn->prepare("INSERT INTO posts (title, content) VALUES (?, ?)");
        $stmt->bind_param("ss", $title, $content);
        if ($stmt->execute()) {
            $message = "✅ تم نشر المقال بنجاح!";
        } else {
            $message = "❌ خطأ في النشر: " . $conn->error;
        }
        $stmt->close();
    } else {
        $message = "⚠️ الرجاء ملء جميع الحقول.";
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>لوحة التحكم - MOUSE AI</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        body { background: #0a0a1a; color: #fff; font-family: 'Segoe UI', sans-serif; padding: 40px; display: flex; justify-content: center; }
        .admin-box { max-width: 700px; width: 100%; background: rgba(255,255,255,0.05); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); }
        h1 { text-align: center; margin-bottom: 30px; }
        input, textarea { width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; font-size: 16px; }
        textarea { min-height: 200px; resize: vertical; }
        button { width: 100%; padding: 12px; background: #6c5ce7; border: none; color: #fff; font-size: 18px; font-weight: bold; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        button:hover { background: #5a4bd1; }
        .msg { padding: 10px; text-align: center; border-radius: 8px; margin-bottom: 20px; background: rgba(0,184,148,0.2); border: 1px solid rgba(0,184,148,0.4); }
        .msg.error { background: rgba(225,112,85,0.2); border-color: rgba(225,112,85,0.4); }
        .back-btn { display: block; text-align: center; margin-top: 20px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; }
        .back-btn:hover { color: #fff; }
    </style>
</head>
<body>
    <div class="admin-box">
        <h1>🐭 <span style="color:#a29bfe;">MOUSE AI</span> - نشر مقال جديد</h1>
        
        <?php if (isset($message)): ?>
            <div class="msg <?php echo (strpos($message, '✅') !== false) ? '' : 'error'; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>

        <form method="POST" action="">
            <input type="text" name="title" placeholder="عنوان المقال" required />
            <textarea name="content" placeholder="محتوى المقال (يمكنك استخدام المسافات والفواصل)" required></textarea>
            <button type="submit" name="publish"><i class="fas fa-paper-plane"></i> نشر المقال للجميع</button>
        </form>

        <a href="index.php" class="back-btn"><i class="fas fa-arrow-left"></i> العودة إلى الموقع</a>
    </div>
</body>
</html>

<?php
$host = "localhost"; // غالباً يكون localhost
$user = "es131742037169245";
$pass = "aba399ef2cd7";
$dbname = "mouse_ai_blog";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("فشل الاتصال بقاعدة البيانات: " . $conn->connect_error);
}
?>

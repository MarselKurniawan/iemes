<?php
/**
 * Image Upload Endpoint for SINERGI IMS
 * 
 * Upload this file to: storage-ims.sinergimax.com/upload.php
 * Create folder: storage-ims.sinergimax.com/uploads/ (chmod 755)
 * 
 * Usage: POST multipart/form-data with 'file' field and optional 'property_id' field
 * Returns: JSON { "success": true, "url": "https://storage-ims.sinergimax.com/uploads/property_id/filename.webp" }
 */

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Config
$baseUploadDir = __DIR__ . '/uploads';
$baseUrl = 'https://storage-ims.sinergimax.com/uploads';
$maxFileSize = 10 * 1024 * 1024; // 10MB
$allowedTypes = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'];

// Validate file
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorCode = $_FILES['file']['error'] ?? 'No file';
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Upload error: $errorCode"]);
    exit;
}

$file = $_FILES['file'];

// Check file size
if ($file['size'] > $maxFileSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File too large (max 10MB)']);
    exit;
}

// Check file type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Invalid file type: $mimeType"]);
    exit;
}

// Get property_id for folder organization
$propertyId = isset($_POST['property_id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['property_id']) : 'general';

// Create directory
$uploadDir = "$baseUploadDir/$propertyId";
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'webp';
$filename = time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$targetPath = "$uploadDir/$filename";

// Move file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    $publicUrl = "$baseUrl/$propertyId/$filename";
    echo json_encode([
        'success' => true,
        'url' => $publicUrl,
        'filename' => $filename,
        'size' => $file['size'],
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save file']);
}

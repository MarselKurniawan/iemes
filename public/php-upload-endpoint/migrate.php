<?php
/**
 * Migration Endpoint for SINERGI IMS
 * 
 * Downloads images from old storage and saves locally.
 * POST JSON: { "images": [{ "url": "https://old-url/image.webp", "property_id": "xxx" }] }
 * 
 * Upload this to: storage-ims.sinergimax.com/migrate.php
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['images']) || !is_array($input['images'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request body']);
    exit;
}

$baseUploadDir = __DIR__ . '/uploads';
$baseUrl = 'https://storage-ims.sinergimax.com/uploads';
$results = [];

foreach ($input['images'] as $item) {
    $url = $item['url'] ?? '';
    $propertyId = preg_replace('/[^a-zA-Z0-9_-]/', '', $item['property_id'] ?? 'general');
    
    if (empty($url)) {
        $results[] = ['old_url' => $url, 'success' => false, 'error' => 'Empty URL'];
        continue;
    }

    // Download image
    $imageData = @file_get_contents($url);
    if ($imageData === false) {
        $results[] = ['old_url' => $url, 'success' => false, 'error' => 'Failed to download'];
        continue;
    }

    // Create directory
    $uploadDir = "$baseUploadDir/$propertyId";
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Save with unique name
    $ext = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'webp';
    $filename = time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = "$uploadDir/$filename";

    if (file_put_contents($targetPath, $imageData)) {
        $newUrl = "$baseUrl/$propertyId/$filename";
        $results[] = ['old_url' => $url, 'success' => true, 'new_url' => $newUrl];
    } else {
        $results[] = ['old_url' => $url, 'success' => false, 'error' => 'Failed to save'];
    }
}

echo json_encode(['success' => true, 'results' => $results]);

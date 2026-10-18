<?php
declare(strict_types=1);

/** GET /api/scenario.php?id=black_swan_saas_v1 → 劇本 JSON（已檢查格式）。 */
require __DIR__ . '/../includes/bootstrap.php';

Http::requireMethod('GET');
try {
    Http::json(Content::scenario((string) ($_GET['id'] ?? '')));
} catch (InvalidArgumentException | DomainException $e) {
    Http::error($e->getMessage(), 404);
}

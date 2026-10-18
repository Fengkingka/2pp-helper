<?php
declare(strict_types=1);

/** 線條圖示（24×24，繼承文字顏色）。 */
function icon(string $name, int $size = 20, string $extra = ''): string
{
    $paths = [
        'grad' => '<path d="M2 9 L12 4 L22 9 L12 14 Z"/><path d="M6 11 V16 C6 17.5 9 19 12 19 C15 19 18 17.5 18 16 V11"/>',
        'startup' => '<path d="M4 20 V13"/><path d="M10 20 V9"/><path d="M16 20 V12"/><path d="M3 8 L9 4 L15 7 L21 3"/>',
        'report' => '<path d="M6 3 H14 L19 8 V21 H6 Z"/><path d="M9 13 H16"/><path d="M9 17 H14"/>',
        'lock' => '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10 V7 C8 4.8 9.8 3 12 3 C14.2 3 16 4.8 16 7 V10"/>',
        'profile' => '<circle cx="12" cy="8" r="4"/><path d="M4 20 C4 16.7 7.6 14 12 14 C16.4 14 20 16.7 20 20"/>',
        'compass' => '<circle cx="12" cy="12" r="9"/><path d="M15 9 L13 13 L9 15 L11 11 Z"/>',
        'doc' => '<path d="M6 3 H14 L19 8 V21 H6 Z"/><path d="M9 13 H16"/><path d="M9 17 H14"/>',
        'search' => '<circle cx="11" cy="11" r="7"/><path d="M16 16 L21 21"/>',
        'mic' => '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11 C5 14.9 8.1 18 12 18 C15.9 18 19 14.9 19 11"/><path d="M12 18 V21"/>',
        'bolt' => '<path d="M13 2 L5 13 H11 L10 22 L18 10 H12 Z"/>',
        'scale' => '<path d="M12 4 V20"/><path d="M6 20 H18"/><path d="M5 7 H19"/><path d="M5 7 L3 13 H7 Z"/><path d="M19 7 L17 13 H21 Z"/>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 L12 13 L21 7"/>',
        'calc' => '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7 H16"/><path d="M8 12 H9"/><path d="M12 12 H13"/><path d="M16 12 H16.5"/><path d="M8 16 H9"/><path d="M12 16 H13"/>',
        'check' => '<path d="M5 12 L10 17 L19 7"/>',
        'back' => '<path d="M15 5 L8 12 L15 19"/>',
        'send' => '<path d="M4 12 L20 4 L14 20 L11 13 Z"/>',
        'spark' => '<path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z"/>',
        'heart' => '<path d="M12 20 C5 15 3 11.5 3 8.5 C3 6 5 4 7.5 4 C9.4 4 11 5.1 12 6.7 C13 5.1 14.6 4 16.5 4 C19 4 21 6 21 8.5 C21 11.5 19 15 12 20 Z"/>',
        'flag' => '<path d="M5 21 V4"/><path d="M5 4 H17 L15 8 L17 12 H5"/>',
        'award' => '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 L8 21 L12 19 L16 21 L15 13.5"/>',
        'headphones' => '<path d="M4 15 V12 C4 7.6 7.6 4 12 4 C16.4 4 20 7.6 20 12 V15"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    ];
    $inner = $paths[$name] ?? '';
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        . 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' . $extra . '>' . $inner . '</svg>';
}

function logo_mark(int $size = 30): string
{
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 30 30" fill="none" aria-hidden="true">'
        . '<circle cx="15" cy="15" r="12" stroke="#E9F0EE" stroke-width="2"/>'
        . '<path d="M15 15 L15 5" stroke="#3FE0B5" stroke-width="2.5" stroke-linecap="round"/>'
        . '<path d="M15 15 L24 20" stroke="#FF8A66" stroke-width="2.5" stroke-linecap="round"/>'
        . '<circle cx="15" cy="15" r="3" fill="#E9F0EE"/></svg>';
}

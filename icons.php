<?php
/**
 * Inline SVG Icons (Feather/Lucide style, currentColor)
 */

function getIcon($name, $options = []) {
    $size = isset($options['size']) ? (int)$options['size'] : 16;
    $class = isset($options['class']) ? htmlspecialchars($options['class']) : '';
    $filled = !empty($options['filled']);

    switch ($name) {
        case 'trophy':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>'
                . '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>'
                . '<path d="M4 22h16"></path>'
                . '<path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path>'
                . '<path d="M6 2h12v7a6 6 0 0 1-12 0V2z"></path>'
                . '</svg>';

        case 'football':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<circle cx="12" cy="12" r="10"></circle>'
                . '<polygon points="12 7 9.5 9 10.5 12.5 13.5 12.5 14.5 9 12 7"></polygon>'
                . '<line x1="12" y1="2" x2="12" y2="7"></line>'
                . '<line x1="4" y1="8" x2="9.5" y2="9"></line>'
                . '<line x1="20" y1="8" x2="14.5" y2="9"></line>'
                . '<line x1="7" y1="18" x2="10.5" y2="12.5"></line>'
                . '<line x1="17" y1="18" x2="13.5" y2="12.5"></line>'
                . '</svg>';

        case 'tennis':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<circle cx="12" cy="12" r="10"></circle>'
                . '<path d="M18.36 5.64a9 9 0 0 0-12.72 12.72"></path>'
                . '<path d="M5.64 5.64a9 9 0 0 1 12.72 12.72"></path>'
                . '</svg>';

        case 'refresh':
            return '<svg class="icon icon-refresh ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>'
                . '<polyline points="21 3 21 8 16 8"></polyline>'
                . '</svg>';

        case 'star':
            $fillAttr = $filled ? 'fill="currentColor"' : 'fill="none"';
            return '<svg class="icon icon-star ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" ' . $fillAttr . ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
                . '</svg>';

        case 'list':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<line x1="8" y1="6" x2="21" y2="6"></line>'
                . '<line x1="8" y1="12" x2="21" y2="12"></line>'
                . '<line x1="8" y1="18" x2="21" y2="18"></line>'
                . '<circle cx="4" cy="6" r="1.25" fill="currentColor"></circle>'
                . '<circle cx="4" cy="12" r="1.25" fill="currentColor"></circle>'
                . '<circle cx="4" cy="18" r="1.25" fill="currentColor"></circle>'
                . '</svg>';

        case 'info':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<circle cx="12" cy="12" r="10"></circle>'
                . '<line x1="12" y1="16" x2="12" y2="12"></line>'
                . '<line x1="12" y1="8" x2="12.01" y2="8"></line>'
                . '</svg>';

        case 'alert':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<circle cx="12" cy="12" r="10"></circle>'
                . '<line x1="12" y1="8" x2="12" y2="12"></line>'
                . '<line x1="12" y1="16" x2="12.01" y2="16"></line>'
                . '</svg>';

        case 'person':
            return '<svg class="icon ' . $class . '" viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                . '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>'
                . '<circle cx="12" cy="7" r="4"></circle>'
                . '</svg>';

        default:
            return '';
    }
}

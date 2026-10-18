<?php
declare(strict_types=1);

/** Bounded, server-only connectors. No caller-controlled URLs or response-body logging. */
final class FitCheckSources
{
    public static function configuration(): array
    {
        return [
            'trends' => ['name' => 'Google Trends · SerpApi', 'configured' => (bool) Config::get('FITCHECK_SERPAPI_KEY')],
            'competition' => ['name' => 'Google Search · SerpApi', 'configured' => (bool) Config::get('FITCHECK_SERPAPI_KEY')],
            'community' => ['name' => 'Hacker News', 'configured' => true],
        ];
    }

    /** Injectable transport is used by local fixture tests, never selected by request parameters. */
    public static function collect(array $p, bool $enabled, ?callable $transport = null): array
    {
        $evidence = []; $statuses = []; $request = $transport ?? [self::class, 'request'];
        foreach (self::configuration() as $key => $config) {
            $status = $config + ['status' => 'not_configured', 'count' => 0, 'checkedAt' => null];
            if (!$enabled) $status['status'] = 'not_requested';
            elseif ($config['configured'] && $p['query'] === '') $status['status'] = 'query_needed';
            elseif ($config['configured']) {
                $status['checkedAt'] = gmdate('c');
                try {
                    $items = match ($key) {
                        'trends' => self::trends($p, $request),
                        'competition' => self::competition($p, $request),
                        'community' => self::community($p, $request),
                    };
                    $status['count'] = count($items);
                    $status['status'] = $items ? 'retrieved' : 'no_results';
                    array_push($evidence, ...$items);
                } catch (Throwable $e) {
                    // Deliberately omit URLs, credentials and provider response text from errors.
                    $status['status'] = 'unavailable';
                }
            }
            $statuses[$key] = $status;
        }
        return ['evidence' => $evidence, 'sources' => $statuses];
    }

    private static function item(string $category, string $provider, string $title, string $url, string $summary, string $date = ''): array
    {
        return ['category' => $category, 'provider' => $provider, 'origin' => 'retrieved',
            'title' => mb_substr($title, 0, 180), 'url' => FitCheck::url($url), 'summary' => mb_substr($summary, 0, 1400),
            'date' => $date, 'retrievedAt' => gmdate('c')];
    }

    private static function trends(array $p, callable $request): array
    {
        $data = $request('GET', 'https://serpapi.com/search.json', [], [
            'engine' => 'google_trends', 'q' => $p['query'], 'data_type' => 'TIMESERIES',
            'date' => 'today 12-m', 'geo' => $p['geo'], 'api_key' => Config::get('FITCHECK_SERPAPI_KEY'),
        ]);
        if (isset($data['error'])) throw new RuntimeException('Provider error');
        $timeline = $data['interest_over_time']['timeline_data'] ?? null;
        if (!is_array($timeline)) throw new RuntimeException('Invalid trends response');
        $points = [];
        foreach ($timeline as $row) {
            $v = $row['values'][0]['extracted_value'] ?? null;
            if (is_numeric($v) && (float) $v >= 0 && (float) $v <= 100 && empty($row['is_partial'])) {
                $points[] = ['date' => (string) ($row['date'] ?? ''), 'value' => (float) $v];
            }
        }
        if (count($points) < 2) return [];
        // These are relative indices, not search volumes, market size, or year-over-year growth.
        $item = self::item('demand', 'Google Trends via SerpApi', $p['query'],
            'https://trends.google.com/trends/explore?' . http_build_query(['q' => $p['query'], 'geo' => $p['geo'], 'date' => 'today 12-m']),
            'Relative Google Trends interest (0–100), trailing 12 months; region: ' . ($p['geo'] ?: 'worldwide') . '. '
            . count($points) . ' observations. First: ' . $points[0]['date'] . ' = ' . $points[0]['value']
            . '; last: ' . end($points)['date'] . ' = ' . end($points)['value']
            . '. Not absolute search volume, willingness to pay, or year-over-year growth. Provider cache may be up to one hour old.', gmdate('Y-m-d'));
        $item['series'] = array_slice($points, -60);
        return [$item];
    }

    private static function competition(array $p, callable $request): array
    {
        // Reuses the existing SerpApi key on the regular Google engine; no extra signup.
        $data = $request('GET', 'https://serpapi.com/search.json', [], [
            'engine' => 'google', 'q' => ($p['competitionQuery'] ?: $p['query']) . ' (startup OR app OR platform)',
            'num' => 5, 'hl' => 'en', 'api_key' => Config::get('FITCHECK_SERPAPI_KEY'),
        ]);
        if (isset($data['error'])) throw new RuntimeException('Provider error');
        if (!is_array($data['organic_results'] ?? null)) throw new RuntimeException('Invalid search response');
        $items = [];
        foreach (array_slice($data['organic_results'], 0, 5) as $row) {
            if (empty($row['title']) || empty($row['link'])) continue;
            $items[] = self::item('competition', 'Google Search via SerpApi', (string) $row['title'],
                (string) $row['link'],
                (string) ($row['snippet'] ?? '') . ' [Keyword search candidate; direct competition, funding, and relevance are not verified.]');
        }
        return $items;
    }

    private static function community(array $p, callable $request): array
    {
        // Hacker News official Algolia search API: free, no key, no registration, no OAuth.
        $data = $request('GET', 'https://hn.algolia.com/api/v1/search', [], [
            'query' => $p['query'], 'tags' => 'story', 'hitsPerPage' => 5,
        ]);
        if (!is_array($data['hits'] ?? null)) throw new RuntimeException('Invalid community response');
        $items = [];
        foreach (array_slice($data['hits'], 0, 5) as $hit) {
            if (empty($hit['title'])) continue;
            $url = (string) ($hit['url'] ?? '');
            if ($url === '' && !empty($hit['objectID'])) $url = 'https://news.ycombinator.com/item?id=' . rawurlencode((string) $hit['objectID']);
            $date = substr((string) ($hit['created_at'] ?? ''), 0, 10);
            // No author names/profiles or comment histories are collected.
            $items[] = self::item('problem', 'Hacker News', (string) $hit['title'], $url,
                mb_substr((string) ($hit['story_text'] ?? ''), 0, 1000), $date);
        }
        return $items;
    }

    private static function request(string $method, string $url, array $headers, array $data): array
    {
        if (!extension_loaded('curl')) throw new RuntimeException('cURL required');
        $allowed = ['serpapi.com', 'hn.algolia.com'];
        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array(parse_url($url, PHP_URL_HOST), $allowed, true)) throw new LogicException('Disallowed host');
        if ($method === 'GET') $url .= '?' . http_build_query($data);
        $body = ''; $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
            CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_WRITEFUNCTION => static function ($ch, string $chunk) use (&$body): int {
                if (strlen($body) + strlen($chunk) > 1048576) return 0;
                $body .= $chunk; return strlen($chunk);
            }]);
        if ($method === 'POST') {
            $json = in_array('Content-Type: application/json', $headers, true);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json ? json_encode($data) : http_build_query($data)]);
        }
        if ($ca = Config::get('LLM_CA_FILE')) curl_setopt($ch, CURLOPT_CAINFO, realpath(dirname(SITE_ROOT) . '/' . $ca) ?: $ca);
        $ok = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); unset($ch);
        if ($ok === false || $status < 200 || $status >= 300) throw new RuntimeException('Source unavailable');
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) throw new RuntimeException('Invalid JSON');
        return $decoded;
    }
}

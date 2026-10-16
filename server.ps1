$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = [IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd('\') + '\'
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:5511/')
$listener.Start()
Write-Host 'VYRN is running at http://127.0.0.1:5511/'

$contentTypes = @{
	'.css' = 'text/css; charset=utf-8'
	'.html' = 'text/html; charset=utf-8'
	'.js' = 'text/javascript; charset=utf-8'
	'.png' = 'image/png'
	'.svg' = 'image/svg+xml'
}

try {
	while ($listener.IsListening) {
		$context = $listener.GetContext()
		$response = $context.Response
		$responseStarted = $false

		try {
			$path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
			if ($path -match '^/api/tgs/([a-z0-9]+-\d+\.tgs)$') {
				$fileName = $Matches[1]
				$request = [Net.HttpWebRequest]::Create("https://nft.fragment.com/gift/$fileName")
				$request.Method = 'GET'
				$request.Timeout = 20000
				$request.ReadWriteTimeout = 20000
				$request.CachePolicy = [Net.Cache.HttpRequestCachePolicy]::new([Net.Cache.HttpRequestCacheLevel]::NoCacheNoStore)
				$request.AutomaticDecompression = [Net.DecompressionMethods]::None
				$upstream = $request.GetResponse()
				$upstreamStream = $upstream.GetResponseStream()
				$memory = [IO.MemoryStream]::new()
				$upstreamStream.CopyTo($memory)
				$bytes = $memory.ToArray()
				$response.StatusCode = 200
				$response.ContentType = 'application/x-tgsticker'
				$response.AddHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
				$response.AddHeader('Pragma', 'no-cache')
				$response.AddHeader('Expires', '0')
				$response.ContentLength64 = $bytes.Length
				$responseStarted = $true
				$response.OutputStream.Write($bytes, 0, $bytes.Length)
				$upstreamStream.Dispose()
				$upstream.Dispose()
				$memory.Dispose()
			} elseif ($path.StartsWith('/api/')) {
				$response.StatusCode = 404
				$response.ContentType = 'text/plain; charset=utf-8'
				$bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
				$response.ContentLength64 = $bytes.Length
				$responseStarted = $true
				$response.OutputStream.Write($bytes, 0, $bytes.Length)
			} else {
				$relativePath = if ($path -eq '/') { 'index.html' } else { $path.TrimStart('/').Replace('/', '\') }
				$filePath = [IO.Path]::GetFullPath((Join-Path $root $relativePath))
				if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($filePath)) {
					$response.StatusCode = 404
					$response.ContentType = 'text/plain; charset=utf-8'
					$bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
				} else {
					$bytes = [IO.File]::ReadAllBytes($filePath)
					$extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
					$response.StatusCode = 200
					$response.ContentType = $contentTypes[$extension]
					if (-not $response.ContentType) {
						$response.ContentType = 'application/octet-stream'
					}
				}
				$response.AddHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
				$response.AddHeader('Pragma', 'no-cache')
				$response.AddHeader('Expires', '0')
				$response.ContentLength64 = $bytes.Length
				$responseStarted = $true
				$response.OutputStream.Write($bytes, 0, $bytes.Length)
			}
		} catch {
			if (-not $responseStarted) {
				try {
					$response.StatusCode = 502
					$response.ContentType = 'text/plain; charset=utf-8'
					$response.AddHeader('Cache-Control', 'no-store')
					$bytes = [Text.Encoding]::UTF8.GetBytes('Fragment request failed')
					$response.ContentLength64 = $bytes.Length
					$responseStarted = $true
					$response.OutputStream.Write($bytes, 0, $bytes.Length)
				} catch {
				}
			}
		} finally {
			try {
				$response.Close()
			} catch {
			}
		}
	}
} finally {
	$listener.Stop()
	$listener.Close()
}
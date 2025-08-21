param(
    [int]$Port = 8000
)

Write-Host "Starting ElemenTails Development Server on port $Port" -ForegroundColor Green
Write-Host "Serving from: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Game will be available at: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Try to open browser
try {
    Start-Process "http://localhost:$Port"
    Write-Host "Opening browser..." -ForegroundColor Green
} catch {
    Write-Host "Could not open browser automatically" -ForegroundColor Yellow
}

# Start simple HTTP server using .NET
Add-Type -AssemblyName System.Net.Http
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "Server started successfully!" -ForegroundColor Green
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        
        $filePath = Join-Path (Get-Location) $path.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            
            # Set content type based on file extension
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html" }
                ".js"   { $response.ContentType = "application/javascript" }
                ".css"  { $response.ContentType = "text/css" }
                ".json" { $response.ContentType = "application/json" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            $errorContent = [System.Text.Encoding]::UTF8.GetBytes("File not found: $path")
            $response.OutputStream.Write($errorContent, 0, $errorContent.Length)
        }
        
        $response.Close()
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    Write-Host "Server stopped." -ForegroundColor Yellow
}

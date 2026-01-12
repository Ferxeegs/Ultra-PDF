# Security Features

Dokumentasi fitur keamanan yang telah diimplementasikan pada UltraPDF Backend API.

## 1. Rate Limiting
- **10 requests per minute** per IP address
- **100 requests per hour** per IP address
- Mencegah abuse dan DDoS attacks
- Konfigurasi melalui environment variables: `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_HOUR`

## 2. CORS Configuration
- **Development**: Allow all origins (`*`)
- **Production**: Hanya allow origins yang terdaftar di `ALLOWED_ORIGINS`
- Hanya method `GET` dan `POST` yang diizinkan
- Hanya headers yang diperlukan: `Content-Type`, `Authorization`
- Preflight cache: 1 jam

## 3. Security Headers
Middleware menambahkan security headers berikut:
- `X-Content-Type-Options: nosniff` - Mencegah MIME type sniffing
- `X-Frame-Options: DENY` - Mencegah clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - Force HTTPS
- `Content-Security-Policy` - Restrict resource loading
- `Referrer-Policy` - Control referrer information
- `Permissions-Policy` - Restrict browser features
- Server header dihapus untuk menyembunyikan teknologi yang digunakan

## 4. File Upload Security

### File Size Validation
- Maximum file size: 100MB (konfigurasi via `MAX_FILE_SIZE_MB`)
- Validasi file tidak kosong

### File Extension Validation
- Hanya ekstensi `.pdf` yang diizinkan
- Case-insensitive validation

### File Content Validation
- Validasi MIME type menggunakan `python-magic` (magic bytes)
- Fallback ke PDF header validation (`%PDF`)
- Mencegah file spoofing (file dengan ekstensi .pdf tapi bukan PDF sebenarnya)

### Path Traversal Prevention
- Filename sanitization
- Path validation untuk memastikan file tetap dalam directory yang diizinkan
- Penghapusan karakter berbahaya: `..`, `/`, `\`, `\x00`
- Maximum filename length: 255 characters

## 5. Input Validation
- Pydantic models untuk validasi input
- Quality parameter validation: hanya `low`, `medium`, `high` yang diizinkan
- Request validation dengan error handling yang aman

## 6. Error Handling
- **Development**: Menampilkan detail error untuk debugging
- **Production**: Generic error messages (tidak expose detail)
- Logging semua errors untuk monitoring
- Global exception handler untuk unhandled exceptions

## 7. Ghostscript Security
- Timeout: 5 menit (konfigurasi via `GS_TIMEOUT`)
- Security flags: `-dSAFER` untuk disable file system access
- Output buffer limit: 1MB
- Validasi output file setelah kompresi

## 8. Request Timeout
- Timeout untuk mencegah request yang hang
- Logging untuk slow requests (>10 detik)

## 9. API Documentation
- **Development**: `/docs` dan `/redoc` tersedia
- **Production**: API docs dinonaktifkan untuk mencegah information disclosure

## 10. Logging
- Structured logging dengan timestamp
- Log semua security events:
  - Invalid file uploads
  - Rate limit violations
  - Path traversal attempts
  - Compression errors
  - Slow requests

## 11. Environment Variables
Semua konfigurasi keamanan dapat diatur melalui environment variables:
- `ENV`: development | production
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins
- `MAX_FILE_SIZE_MB`: Maximum file size in MB
- `RATE_LIMIT_PER_MINUTE`: Rate limit per minute
- `RATE_LIMIT_PER_HOUR`: Rate limit per hour
- `GS_TIMEOUT`: Ghostscript timeout in seconds

## Best Practices untuk Production

1. **Set ENV=production** untuk mengaktifkan semua security features
2. **Set ALLOWED_ORIGINS** dengan domain frontend yang valid
3. **Disable API docs** (otomatis jika ENV=production)
4. **Monitor logs** untuk security events
5. **Use HTTPS** di production
6. **Regular security updates** untuk dependencies
7. **Backup strategy** untuk file uploads (jika diperlukan)
8. **Resource limits** di Docker/container untuk mencegah resource exhaustion

## Dependencies Security

Dependencies yang digunakan untuk keamanan:
- `slowapi`: Rate limiting
- `pydantic`: Input validation
- `python-magic`: File content validation
- `python-dotenv`: Environment variable management



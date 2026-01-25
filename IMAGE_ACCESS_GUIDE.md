# Image Access Guide

This guide explains how profile pictures are publicly accessible.

## How Images Are Served

### 1. Storage Location
- Images are stored in: `api/uploads/profiles/`
- Filenames format: `admin_{userId}_{timestamp}.{extension}`

### 2. Public URL Format
Images are accessible via:
```
http://your-api-domain:port/uploads/profiles/{filename}
```

For example:
- Local: `http://localhost:3004/uploads/profiles/admin_1_1769344304051.png`
- Production: `https://api.yourdomain.com/uploads/profiles/admin_1_1769344304051.png`

### 3. Static File Serving
The Express server is configured to serve static files from the `uploads` directory:
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### 4. CORS Configuration
Images are served with CORS headers allowing access from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET`

### 5. URL Construction
The API automatically constructs full URLs when returning profile picture data:
- Uses request origin (`req.protocol` and `req.get('host')`)
- Falls back to `API_BASE_URL` environment variable if set
- Falls back to `localhost:PORT` for development

## Environment Variables

Set in `api/.env`:
```env
API_BASE_URL=https://api.yourdomain.com
PORT=3004
```

## Testing Image Access

### 1. Direct Browser Access
Open in browser:
```
http://localhost:3004/uploads/profiles/admin_1_1769344304051.png
```

### 2. Using curl
```bash
curl -I http://localhost:3004/uploads/profiles/admin_1_1769344304051.png
```

### 3. In Frontend Code
```javascript
const imageUrl = `${API_BASE_URL}/uploads/profiles/${filename}`;
<img src={imageUrl} alt="Profile" />
```

## Troubleshooting

### Images Not Loading

1. **Check file exists:**
   ```bash
   ls -la api/uploads/profiles/
   ```

2. **Check server is running:**
   ```bash
   curl http://localhost:3004/api/health
   ```

3. **Check CORS:**
   - Browser console for CORS errors
   - Verify `Access-Control-Allow-Origin` header

4. **Check URL format:**
   - Ensure URL matches: `{baseUrl}/uploads/profiles/{filename}`
   - No `/api` prefix needed for uploads

5. **Check file permissions:**
   ```bash
   chmod -R 755 api/uploads/profiles/
   ```

## Production Setup

### 1. Set API_BASE_URL
```env
API_BASE_URL=https://api.yourdomain.com
```

### 2. Ensure Directory Exists
```bash
mkdir -p api/uploads/profiles
chmod -R 755 api/uploads/profiles
```

### 3. Configure Reverse Proxy (if using nginx)
```nginx
location /uploads/ {
    proxy_pass http://localhost:3004/uploads/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. CDN Integration (Optional)
For better performance, you can:
- Upload images to CDN (AWS S3, Cloudinary, etc.)
- Store CDN URL in database instead of filename
- Update URL construction in `adminProfile.js`

## Security Considerations

1. **File Validation:** Only image files are accepted (jpeg, jpg, png, gif, webp)
2. **File Size Limit:** Maximum 5MB per image
3. **Filename Sanitization:** Filenames are auto-generated to prevent path traversal
4. **Access Control:** While images are publicly accessible, only admins can upload

## Example API Responses

### Get Profile (returns full URL)
```json
{
  "id": 1,
  "name": "Admin User",
  "email": "admin@example.com",
  "profile_picture": "http://localhost:3004/uploads/profiles/admin_1_1769344304051.png",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Get Active Admins (returns full URLs)
```json
{
  "count": 2,
  "admins": [
    {
      "id": 1,
      "name": "Admin 1",
      "email": "admin1@example.com",
      "profile_picture": "http://localhost:3004/uploads/profiles/admin_1_1769344304051.png",
      "last_seen": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```


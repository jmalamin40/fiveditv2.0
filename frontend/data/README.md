# Services Data Management

This directory contains JSON data files for the website.

## services.json

This file contains all service information displayed on the services page.

### Structure

```json
{
  "services": [
    {
      "id": "unique-service-id",
      "icon": "IconName",
      "title": "Service Title",
      "short": "Short description",
      "description": "Full description",
      "features": ["Feature 1", "Feature 2"],
      "color": "blue" | "cyan",
      "category": "Category Name",
      "link": "/optional-link"
    }
  ]
}
```

### Available Icons

The following icon names can be used in the `icon` field:
- `Server`
- `Code2`
- `ShoppingCart`
- `Bot`
- `Network`
- `Settings`
- `Activity`
- `Lock`
- `Plug`
- `Wrench`

### Adding a New Service

1. Open `/data/services.json`
2. Add a new object to the `services` array:

```json
{
  "id": "my-new-service",
  "icon": "Server",
  "title": "My New Service",
  "short": "Brief description",
  "description": "Full detailed description",
  "features": [
    "Feature 1",
    "Feature 2",
    "Feature 3"
  ],
  "color": "blue",
  "category": "Infrastructure",
  "link": "/optional-page-link"
}
```

### Updating a Service

Simply edit the JSON object in the `services` array. Changes will be reflected immediately after saving.

### Categories

Current categories:
- Infrastructure
- Development
- Installation
- AI Development
- Architecture
- Management
- Security
- Integration

### Color Options

- `blue` - Blue gradient
- `cyan` - Cyan gradient

### Notes

- The `id` field must be unique
- The `icon` field must match one of the available icon names
- The `link` field is optional - use it to link to dedicated service pages
- All fields except `link` are required


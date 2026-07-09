# App Icons

The PWA requires PNG icons in two sizes:
- `golf-icon-192.png` (192x192)
- `golf-icon-512.png` (512x512)

## Generate from SVG

Use any SVG-to-PNG converter or ImageMagick:

```bash
# Using ImageMagick (if installed)
magick golf-icon.svg -resize 192x192 golf-icon-192.png
magick golf-icon.svg -resize 512x512 golf-icon-512.png
```

Or use an online converter:
- https://cloudconvert.com/svg-to-png
- https://www.svgviewer.dev/

## Temporary Workaround

For development, the app will work without icons, though the browser may show warnings.
The icons are required for a complete PWA installation experience.

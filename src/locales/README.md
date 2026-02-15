# Internationalization (i18n) Files

This directory contains translation files for HourWise EU. These files are securely bundled with the application and not publicly accessible.

## Adding a New Language

1. Create a new JSON file named with the language code (e.g., `fr.json` for French, `de.json` for German)
2. Copy the structure from `en.json`
3. Translate all values while keeping the keys unchanged
4. Import the new language file in your i18n configuration

## File Structure

Each language file should follow the same structure:

```json
{
  "app": {},
  "navigation": {},
  "auth": {},
  "dashboard": {}
}
```

## Security Note

These files are bundled during the build process and are not directly accessible via HTTP requests. They are only included in the JavaScript bundle that's served to authenticated users.

## Supported Languages

- English (en.json) - Default
- [Add your additional languages here]

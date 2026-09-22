# Personal Color Pocket

A mobile-first personal color companion that estimates a 12-season
personal-color subtype and helps users understand and use their palette.

## V1.0 features

- TH / EN
- Men / Women presentation
- 11-question visual-assisted quiz
- 12 subtype deterministic classification
- confidence / explanation
- personal palette
- style examples
- color checker
- local-only persistence
- no account/backend required

## Development

```
npm install
npm run dev
npm test
npm run build
```

## Architecture note

- scoring is deterministic
- generated fashion imagery is presentation/inspiration only
- canonical HEX palette data is authoritative
- presentation preference does not affect classification

## Privacy

- V1.0 stores profile state locally in the browser
- no account/backend/upload is required

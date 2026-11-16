# AI Artist Checker for YouTube Music

A Firefox add-on that shows a badge next to the YouTube Music player saying whether the current artist is AI-generated, and lets you record your own verdict.

## Verdicts

Highest priority first:

| Badge | Meaning |
| --- | --- |
| AI / Not AI | Your own verdict for the artist's channel. |
| Maybe AI | Zoundhub rates an artist with the same name 4 or 5 out of 5. It may be a different artist. |
| Not listed | None of the above. |

A track with several artists gets the most suspect verdict among them. Click the badge to see each artist and to set or clear your verdict.

## Data

[Zoundhub](https://zoundhub.com)'s `artists-all.json`, downloaded at most once a day and matched by artist name. Zoundhub states no license for this data ("All rights reserved").

## Privacy

The only request the add-on makes is the Zoundhub download, without cookies. Lookups happen in the browser. Your verdicts are kept in the add-on's sync storage, which Firefox Sync copies to your other browsers when Add-ons sync is on.

Sync storage holds about 3,500 verdicts. The badge menu shows how much is used and warns from 90%; past the limit, new verdicts are refused.

## Development

Needs Node.js. `npm ci` installs [web-ext](https://github.com/mozilla/web-ext), Mozilla's tool for add-ons. `npm run lint` checks `extension/` with the same linter addons.mozilla.org runs on upload, and `npm run build` packages it as a zip in `web-ext-artifacts/`. `store/` holds the addons.mozilla.org listing text and screenshots, and the icon's original image.

## License

[MIT License](LICENSE).

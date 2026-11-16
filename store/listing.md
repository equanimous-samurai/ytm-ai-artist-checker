# AI Artist Checker for YouTube Music

## Name

AI Artist Checker for YouTube Music

## Add-on URL

ytm-ai-artist-checker

## Summary

Flags YouTube Music artists that may be AI-generated, from Zoundhub's list, and lets you mark them as AI or not AI yourself.

## Description

Know when the song you're hearing may come from an AI-generated artist.

A small badge sits next to the track in the YouTube Music player bar:

- **Maybe AI** (yellow): Zoundhub, a community list of AI music, rates an artist with the same name 4 or 5 out of 5. It may be a different artist who shares the name.
- **AI** (red) / **Not AI** (green): your own verdict for that artist.
- **Not listed**: Zoundhub doesn't know the artist and you haven't given a verdict.

Click the badge to see each artist on the track and to mark them as AI or not AI. Your verdict always wins over Zoundhub. A track with several artists shows the most suspect label among them.

**Your verdicts follow you.** They're kept in Firefox's sync storage, so they reach your other computers when Add-ons sync is on.

**Private by design.** Lookups happen in your browser. The only request the add-on makes is downloading Zoundhub's public list, at most once a day, without cookies. Nothing about what you listen to leaves your computer.

Data: [Zoundhub](https://zoundhub.com).
Source code: <https://github.com/equanimous-samurai/ytm-ai-artist-checker>

## Categories

Photos, Music & Videos

## Tags

music, youtube

## Support

- Homepage: <https://github.com/equanimous-samurai/ytm-ai-artist-checker>
- Support site: <https://github.com/equanimous-samurai/ytm-ai-artist-checker/issues>

## License

MIT License

## Privacy policy

AI Artist Checker for YouTube Music collects no data.

It reads the artist names and channel links shown in the YouTube Music player bar and compares them, inside your browser, with a list downloaded from Zoundhub (<https://zoundhub.com/data/artists-all.json>) at most once a day. That download is sent without cookies and carries nothing about you or what you play; like any web request, it shows Zoundhub your IP address.

Your verdicts are kept in Firefox's sync storage. They reach Mozilla's servers only if you turn on Add-ons sync in Firefox Sync. The developer receives nothing.

## Notes for reviewers

- The background script downloads <https://zoundhub.com/data/artists-all.json> at most once a day, with `credentials: "omit"` and a size cap. It is JSON data, parsed with `JSON.parse`, never run.
- To test, no sign-in needed: open <https://music.youtube.com/watch?v=WJkBEfAMDms> (Aventhis, on Zoundhub's list). The badge next to the track reads "Maybe AI"; click it to mark the artist as AI or not AI.

## Release notes (0.1.0)

First release.

## Screenshot captions

1. `1-yellow.png`: Zoundhub rates an artist with this name as likely AI.
2. `2-yellow-card.png`: Click the badge to see why, and to give your own verdict.
3. `3-red.png`: You marked this artist as AI.
4. `4-green.png`: You marked this artist as not AI. Your verdicts sync to your other Firefox installs.

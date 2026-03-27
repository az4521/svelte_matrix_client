# Svelte Matrix Client

This is my first test of Claude Code, creating a matrix client. ~~every existing matrix client sucks, so being better than them isn't really a high bar. imo initial commit has already achieved this~~ actually now that i look, cinny is pretty good, but i wanna do this anyway

things left to do:

Messaging

- Message search
- Threads/replies as collapsible threads
- Voice messages (m.audio recording)
- Notifications
- Push notifications (via a push gateway/service worker)
- Message forwarding
- Polls (m.poll / MSC3381)

Rooms

- Creating rooms within spaces and spaces
- Initiating room upgrades
- Room directory / public room search
- Knock to join (requesting access to invite-only rooms)
- Per-room notification settings (all messages, mentions only, muted)
- Notification badge on browser tab (favicon)
- Moderation (kick/ban/deleting messages)
- Nested spaces
- matrix.to / matrix: URI link handling

User

- User profile editing (display name, avatar)
- User info panel when clicking a member (profile, shared rooms, DM button)
- Presence (online/away/offline status)
- Ignore/block users
- SSO / OAuth login
- Device/session management
- Account settings (password change, deactivation)

Encryption

- E2EE
- Device verification
- Key backup

Media

- Audio/video calling (WebRTC)
- Better URL previews (Blocked by Tuwunel)

feel free to try it out :) i host a copy at https://matrix.crafty.moe/

same install process as every other js app

```
git clone https://github.com/az4521/svelte_matrix_client.git
cd svelte_matrix_client
npm i
npm run dev
```

if you wanna serve this, run `npm run build` and copy the files in build/ into a web directory. it's all static files so there's no backend to run

---

## Editing src/lib/config.ts

### DEFAULT_HOMESERVER

this is fairly obvious, it's the default homeserver url for the login page

### INLINE_MEDIA_HOSTNAMES

this is an array of "safe" hostnames that the client can fetch media from directly without going through the matrix homeserver url preview endpoint

### IG_PROXY

this is a simple proxy that removes CORS headers from vxinstagram. you can set one up with the following nginx config

```
location /igproxy/ {
    proxy_pass https://vxinstagram.com/;
    proxy_set_header Host vxinstagram.com;
    proxy_set_header Referer https://vxinstagram.com/;
    proxy_ssl_server_name on;

    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET";

    # Strip cookies/auth from the proxied response
    proxy_hide_header Set-Cookie;
    proxy_hide_header Authorization;
}
```
